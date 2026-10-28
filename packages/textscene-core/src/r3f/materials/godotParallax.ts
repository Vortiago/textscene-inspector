/**
 * Godot's height mapping in three's programs: a parallax shift of every texture coordinate
 * by the depth the heightmap reads (`material.cpp:1540-1610`). The heightmap has its own sampler
 * and coordinate, so it reaches every material class and moves no vertex, as in Godot.
 */

import * as THREE from 'three';
import type { IUniform, Material } from 'three';
import { composeInjections, defining, type ProgramInjection } from '../materialProgramInputs';
import { editedProgram } from '../shaderPatch/chunkPatch';
import { recordedOn } from './recordedOnMaterial';
import { pendingMapStandIn } from './pendingMapStandIn';
import { HEIGHTMAP_DEFAULTS, type Heightmap } from '../../resources/materials/standardmaterial3d/types';

/** The last declaration before `main`, after the normal and the varyings the parallax reads. */
const PARS_ANCHOR = '#include <clipping_planes_pars_fragment>';
const MAP_ANCHOR = '#include <map_fragment>';

/**
 * three's texture coordinates that Godot's `base_uv` can stand for: all but the lightmap's. Each
 * is `v<Map>Uv`, the coordinate of the material's `<map>`.
 */
const MAP_UVS = [
  'vMapUv',
  'vAlphaMapUv',
  'vAoMapUv',
  'vBumpMapUv',
  'vNormalMapUv',
  'vEmissiveMapUv',
  'vMetalnessMapUv',
  'vRoughnessMapUv',
  'vAnisotropyMapUv',
  'vClearcoatMapUv',
  'vClearcoatNormalMapUv',
  'vClearcoatRoughnessMapUv',
  'vSheenColorMapUv',
  'vSheenRoughnessMapUv',
  'vSpecularMapUv',
  'vSpecularColorMapUv',
  'vSpecularIntensityMapUv',
  'vTransmissionMapUv',
  'vThicknessMapUv',
  'vIridescenceMapUv',
  'vIridescenceThicknessMapUv',
];

/**
 * The view direction in the surface's tangent frame, with Godot's flips, and the shifted
 * coordinate. Without mesh tangents the frame comes from the screen derivatives, as three's
 * `getTangentFrame` builds it.
 */
const PARALLAX_PARS = /* glsl */ `${PARS_ANCHOR}
uniform sampler2D godotHeightmap;
varying vec2 vGodotHeightmapUv;
uniform float godotHeightmapScale;
uniform vec2 godotHeightmapLayers;
uniform vec2 godotHeightmapFlip;

float godotHeightmapDepth( const in vec2 uv ) {
	#ifdef GODOT_HEIGHTMAP_READS_HEIGHT
		return texture2D( godotHeightmap, uv ).r;
	#else
		return 1.0 - texture2D( godotHeightmap, uv ).r;
	#endif
}

vec3 godotHeightmapViewDir( const in vec2 uv ) {
	#ifdef FLAT_SHADED
		vec3 normal = normalize( cross( dFdx( vViewPosition ), dFdy( vViewPosition ) ) );
	#else
		vec3 normal = normalize( vNormal );
		#ifdef DOUBLE_SIDED
			normal *= gl_FrontFacing ? 1.0 : - 1.0;
		#endif
	#endif
	#ifdef USE_TANGENT
		vec3 tangent = normalize( vTangent );
		vec3 bitangent = normalize( vBitangent );
	#else
		vec3 q0 = dFdx( - vViewPosition );
		vec3 q1 = dFdy( - vViewPosition );
		vec2 st0 = dFdx( uv );
		vec2 st1 = dFdy( uv );
		vec3 q1perp = cross( q1, normal );
		vec3 q0perp = cross( normal, q0 );
		vec3 tangent = normalize( q1perp * st0.x + q0perp * st1.x );
		vec3 bitangent = normalize( q1perp * st0.y + q0perp * st1.y );
	#endif
	vec3 view = normalize( vViewPosition );
	return normalize( vec3(
		dot( view, tangent * godotHeightmapFlip.x ),
		dot( view, bitangent * godotHeightmapFlip.y ),
		dot( view, normal )
	) );
}

vec2 godotParallax( const in vec2 uv ) {
	vec3 viewDir = godotHeightmapViewDir( uv );
	#ifdef GODOT_DEEP_PARALLAX
		// At least one layer: a loop that never ends on the GPU loses the WebGL context.
		float layers = max( mix( godotHeightmapLayers.y, godotHeightmapLayers.x, abs( viewDir.z ) ), 1.0 );
		float layerDepth = 1.0 / layers;
		vec2 delta = viewDir.xy * godotHeightmapScale * 0.01 / layers;
		vec2 offset = uv;
		float depth = godotHeightmapDepth( offset );
		float currentDepth = 0.0;
		while ( currentDepth < depth ) {
			offset -= delta;
			depth = godotHeightmapDepth( offset );
			currentDepth += layerDepth;
		}
		vec2 previous = offset + delta;
		float afterDepth = depth - currentDepth;
		float beforeDepth = godotHeightmapDepth( previous ) - currentDepth + layerDepth;
		return mix( offset, previous, afterDepth / ( afterDepth - beforeDepth ) );
	#else
		return uv - viewDir.xy * godotHeightmapDepth( uv ) * godotHeightmapScale * 0.01;
	#endif
}`;

/**
 * The shift, then each UV1 coordinate of `material` redefined to carry it, before the first map is
 * read. A macro never expands inside itself, so each reads its own varying.
 */
function parallaxShift(material: Material): string {
  const shifted = MAP_UVS.filter((uv) => readsUv1(material, uv));
  return `vec2 godotParallaxShift = godotParallax( vGodotHeightmapUv ) - vGodotHeightmapUv;
${shifted.map((uv) => `#define ${uv} ( ${uv} + godotParallaxShift )`).join('\n')}
${MAP_ANCHOR}`;
}

/**
 * Whether the map behind coordinate `uv` reads UV1. Godot shifts `base_uv2` only under a UV2
 * detail layer (`material.cpp:1604-1607`), which no map here draws. three keys each map's UV
 * channel into the program, so a rebind to another channel compiles this again.
 */
function readsUv1(material: Material, uv: string): boolean {
  const mapName = uv.charAt(1).toLowerCase() + uv.slice(2, -'Uv'.length);
  const map = (material as unknown as Record<string, unknown>)[mapName];
  return !(map instanceof THREE.Texture) || map.channel === 0;
}

/** Where a material records its height mapping. */
const HEIGHTMAP_KEY = 'godotHeightmap';

/** The `userData` that gives a material its height mapping, none for `null`. */
export function heightmapUserData(heightmap: Heightmap | null): Record<string, unknown> {
  return heightmap ? { [HEIGHTMAP_KEY]: heightmap } : {};
}

/**
 * The heightmap texture of each material. Written only by `bindHeightmap`, and collected with its
 * material. Not `userData`, which a material's clone copies through JSON.
 */
// eslint-disable-next-line no-restricted-syntax -- bindHeightmap writes or deletes an entry from outside
const heightmapTextures = new WeakMap<Material, THREE.Texture>();

/** Gives `material` the texture its heightmap samples, or none. A rebind needs no recompile. */
export function bindHeightmap(material: Material, texture: THREE.Texture | null): void {
  if (texture) heightmapTextures.set(material, texture);
  else heightmapTextures.delete(material);
}

/**
 * Godot's sampler is `hint_default_black` (`material.cpp:1172`), so a heightmap with no texture reads
 * the heightmap slot's stand-in, which is black.
 */
function heightmapTextureOf(material: Material): THREE.Texture {
  return heightmapTextures.get(material) ?? pendingMapStandIn('heightmap_texture');
}

/** Uniforms that read `material` at each upload, so a re-parse that changes only a value needs no remount. */
function heightmapUniforms(material: Material): Record<string, IUniform> {
  const heightmap = () => recordedOn(material, HEIGHTMAP_KEY, HEIGHTMAP_DEFAULTS);
  return {
    godotHeightmap: {
      get value() {
        return heightmapTextureOf(material);
      },
    },
    // The texture's own transform, as three's `mapTransform` carries the slot's UV1 transform.
    godotHeightmapTransform: {
      get value() {
        const texture = heightmapTextureOf(material);
        if (texture.matrixAutoUpdate) texture.updateMatrix();
        return texture.matrix;
      },
    },
    godotHeightmapScale: {
      get value() {
        return heightmap().scale;
      },
    },
    godotHeightmapLayers: {
      get value() {
        return heightmap().layers;
      },
    },
    godotHeightmapFlip: {
      get value() {
        return heightmap().flip;
      },
    },
  };
}

/** The heightmap's own coordinate, `base_uv` under the texture's transform. */
const HEIGHTMAP_UV_PARS = `#include <uv_pars_vertex>
uniform mat3 godotHeightmapTransform;
varying vec2 vGodotHeightmapUv;`;

const HEIGHTMAP_UV = `#include <uv_vertex>
vGodotHeightmapUv = ( godotHeightmapTransform * vec3( uv, 1.0 ) ).xy;`;

/**
 * What three's unshaded program lacks of what the parallax reads: the view position, and the
 * normal its fragment program declares but its vertex program never writes. The normal chunks run
 * only where neither an environment map nor skinning has run them already.
 */
const UNSHADED_VERTEX_PARS = `#include <common>
varying vec3 vViewPosition;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif`;

const UNSHADED_VERTEX = `#include <project_vertex>
vViewPosition = - mvPosition.xyz;
#ifndef FLAT_SHADED
	#if ! defined( USE_ENVMAP ) && ! defined( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	vNormal = normalize( transformedNormal );
#endif`;

const UNSHADED_FRAGMENT_PARS = `varying vec3 vViewPosition;
${PARS_ANCHOR}`;

const UNSHADED_PARALLAX_INPUTS: ProgramInjection = {
  cacheKey: 'godot-parallax-unshaded',
  onBeforeCompile(shader) {
    editedProgram(
      shader,
      {
        vertex: [
          { three: '#include <common>', godot: UNSHADED_VERTEX_PARS },
          { three: '#include <project_vertex>', godot: UNSHADED_VERTEX },
        ],
        fragment: [{ three: PARS_ANCHOR, godot: UNSHADED_FRAGMENT_PARS }],
      },
      'unshaded parallax'
    );
  },
};

const GODOT_PARALLAX: ProgramInjection = {
  cacheKey: 'godot-parallax',
  onBeforeCompile(shader) {
    Object.assign(shader.uniforms, heightmapUniforms(this));
    editedProgram(
      shader,
      {
        vertex: [
          { three: '#include <uv_pars_vertex>', godot: HEIGHTMAP_UV_PARS },
          { three: '#include <uv_vertex>', godot: HEIGHTMAP_UV },
        ],
        fragment: [
          { three: PARS_ANCHOR, godot: PARALLAX_PARS },
          { three: MAP_ANCHOR, godot: parallaxShift(this) },
        ],
      },
      'parallax'
    );
  },
};

const DEEP_PARALLAX = defining('GODOT_DEEP_PARALLAX');
const READS_HEIGHT = defining('GODOT_HEIGHTMAP_READS_HEIGHT');

/** What a lit material with `heightmap` compiles with. */
export function parallaxInjection(heightmap: Heightmap): ProgramInjection | undefined {
  return composeInjections([
    GODOT_PARALLAX,
    heightmap.isDeep ? DEEP_PARALLAX : undefined,
    heightmap.readsHeight ? READS_HEIGHT : undefined,
  ]);
}

/** What an unshaded material with `heightmap` compiles with. */
export function unshadedParallaxInjection(heightmap: Heightmap): ProgramInjection | undefined {
  return composeInjections([UNSHADED_PARALLAX_INPUTS, parallaxInjection(heightmap)]);
}
