/**
 * Godot's height mapping in three's programs: a parallax shift of every texture coordinate
 * by the depth the heightmap reads (`material.cpp:1540-1610`). Godot moves no vertex, so three's
 * `displacementMap` slot carries the heightmap at displacement scale 0, and this patch reads it.
 */

import * as THREE from 'three';
import type { IUniform, Material, MeshStandardMaterial } from 'three';
import { composeInjections, defining, type ProgramInjection } from '../materialProgramInputs';
import { recordedOn } from './recordedOnMaterial';
import { HEIGHTMAP_DEFAULTS, type Heightmap } from '../../resources/materials/standardmaterial3d/types';

/** The last declaration before `main`, after the normal and the varyings the parallax reads. */
const PARS_ANCHOR = '#include <clipping_planes_pars_fragment>';
const MAP_ANCHOR = '#include <map_fragment>';

/** three's texture coordinates that Godot's `base_uv` stands for: all but the lightmap's. */
const SHIFTED_UVS = [
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
uniform sampler2D displacementMap;
varying vec2 vDisplacementMapUv;
uniform float godotHeightmapScale;
uniform vec2 godotHeightmapLayers;
uniform vec2 godotHeightmapFlip;

float godotHeightmapDepth( const in vec2 uv ) {
	#ifdef GODOT_HEIGHTMAP_READS_HEIGHT
		return texture2D( displacementMap, uv ).r;
	#else
		return 1.0 - texture2D( displacementMap, uv ).r;
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
 * The shift, then each coordinate redefined to carry it, before the first map is read. A macro
 * never expands inside itself, so each reads its own varying.
 */
const PARALLAX_SHIFT = `vec2 godotParallaxShift = godotParallax( vDisplacementMapUv ) - vDisplacementMapUv;
${SHIFTED_UVS.map((uv) => `#define ${uv} ( ${uv} + godotParallaxShift )`).join('\n')}
${MAP_ANCHOR}`;

/** Where a material records its height mapping. */
const HEIGHTMAP_KEY = 'godotHeightmap';

/** The `userData` that gives a material its height mapping, none for `null`. */
export function heightmapUserData(heightmap: Heightmap | null): Record<string, unknown> {
  return heightmap ? { [HEIGHTMAP_KEY]: heightmap } : {};
}

/** Uniforms that read `material` at each upload, so a re-parse that changes only a value needs no remount. */
function heightmapUniforms(material: Material): Record<string, IUniform> {
  const heightmap = () => recordedOn(material, HEIGHTMAP_KEY, HEIGHTMAP_DEFAULTS);
  return {
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

/**
 * What three's unshaded program lacks of what the parallax reads: the view position, the normal
 * its fragment program declares but its vertex program never writes, and the displacement
 * uniforms that `WebGLMaterials` fills for any material with the slot. The normal chunks run only
 * where neither an environment map nor skinning has run them already.
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

/** True when `material` has a heightmap bound, which keys its program. */
function hasHeightmap(material: Material): boolean {
  return !!(material as MeshStandardMaterial).displacementMap;
}

const UNSHADED_PARALLAX_INPUTS: ProgramInjection = {
  cacheKey: 'godot-parallax-unshaded',
  onBeforeCompile(shader) {
    if (!hasHeightmap(this)) return;
    Object.assign(shader.uniforms, THREE.UniformsUtils.clone(THREE.UniformsLib.displacementmap));
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', UNSHADED_VERTEX_PARS)
      .replace('#include <project_vertex>', UNSHADED_VERTEX);
    shader.fragmentShader = shader.fragmentShader.replace(PARS_ANCHOR, UNSHADED_FRAGMENT_PARS);
  },
};

const GODOT_PARALLAX: ProgramInjection = {
  cacheKey: 'godot-parallax',
  onBeforeCompile(shader) {
    // Only a bound heightmap declares the varying in the vertex program, and three defines
    // `USE_DISPLACEMENTMAP` there alone.
    if (!hasHeightmap(this)) return;
    Object.assign(shader.uniforms, heightmapUniforms(this));
    shader.fragmentShader = shader.fragmentShader
      .replace(PARS_ANCHOR, PARALLAX_PARS)
      .replace(MAP_ANCHOR, PARALLAX_SHIFT);
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

/** What an `UnshadedMaterial` with `heightmap` compiles with. */
export function unshadedParallaxInjection(heightmap: Heightmap): ProgramInjection | undefined {
  return composeInjections([UNSHADED_PARALLAX_INPUTS, parallaxInjection(heightmap)]);
}
