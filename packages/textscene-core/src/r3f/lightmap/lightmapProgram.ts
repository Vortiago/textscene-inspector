/**
 * Godot's lightmap read in three's lit programs: a lightmapped surface's ambient is its texel of the
 * atlas, at its UV2 placed by its user rect and slice (`scene_forward_clustered.glsl:1835-1876`).
 * Scene and sky ambient give way to it (`:1739-1759`), and so does a ReflectionProbe's
 * (`probeShaderChunk.ts`). three's irradiance is Godot's ambient times PI.
 */

import * as THREE from 'three';
import type { IUniform, Material } from 'three';
import { composeInjections, defining, type ProgramInjection } from '../materialProgramInputs';
import type { LightmapAssignment } from './sceneLightmaps';

/** The last declaration before `main`. */
const PARS_ANCHOR = '#include <clipping_planes_pars_fragment>';
const MAPS_ANCHOR = '#include <lights_fragment_maps>';

/**
 * Godot's bicubic B-spline filter, four bilinear taps (`:921-978`), and its read of a slice: one
 * layer of light, or four of directional light whose L1 bands it lights along the normal in the
 * LightmapGI's space. Exposure normalisation is 1 without camera attributes
 * (`render_forward_clustered.cpp:1222-1227`).
 */
const LIGHTMAP_PARS = /* glsl */ `${PARS_ANCHOR}
uniform bool godotLightmapActive;
uniform highp sampler2DArray godotLightmap;
uniform vec4 godotLightmapUvScale;
uniform float godotLightmapSlice;
uniform bool godotLightmapUsesSH;
uniform bool godotLightmapUsesBicubic;
uniform vec2 godotLightmapTextureSize;
uniform mat3 godotLightmapNormalBasis;
varying vec2 vGodotLightmapUv;

float godotLightmapW0( float a ) {
	return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
}

float godotLightmapW1( float a ) {
	return ( 1.0 / 6.0 ) * ( a * a * ( 3.0 * a - 6.0 ) + 4.0 );
}

float godotLightmapW2( float a ) {
	return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
}

float godotLightmapW3( float a ) {
	return ( 1.0 / 6.0 ) * ( a * a * a );
}

float godotLightmapG0( float a ) {
	return godotLightmapW0( a ) + godotLightmapW1( a );
}

float godotLightmapG1( float a ) {
	return godotLightmapW2( a ) + godotLightmapW3( a );
}

float godotLightmapH0( float a ) {
	return - 1.0 + godotLightmapW1( a ) / ( godotLightmapW0( a ) + godotLightmapW1( a ) );
}

float godotLightmapH1( float a ) {
	return 1.0 + godotLightmapW3( a ) / ( godotLightmapW2( a ) + godotLightmapW3( a ) );
}

vec3 godotLightmapBicubic( vec3 uvw ) {
	vec2 texelSize = vec2( 1.0 ) / godotLightmapTextureSize;
	vec2 st = uvw.xy * godotLightmapTextureSize + vec2( 0.5 );
	vec2 iuv = floor( st );
	vec2 fuv = fract( st );
	float g0x = godotLightmapG0( fuv.x );
	float g1x = godotLightmapG1( fuv.x );
	float h0x = godotLightmapH0( fuv.x );
	float h1x = godotLightmapH1( fuv.x );
	float h0y = godotLightmapH0( fuv.y );
	float h1y = godotLightmapH1( fuv.y );
	vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - vec2( 0.5 ) ) * texelSize;
	vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - vec2( 0.5 ) ) * texelSize;
	vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - vec2( 0.5 ) ) * texelSize;
	vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - vec2( 0.5 ) ) * texelSize;
	return ( godotLightmapG0( fuv.y ) * ( g0x * texture( godotLightmap, vec3( p0, uvw.z ) ).rgb + g1x * texture( godotLightmap, vec3( p1, uvw.z ) ).rgb ) ) +
		( godotLightmapG1( fuv.y ) * ( g0x * texture( godotLightmap, vec3( p2, uvw.z ) ).rgb + g1x * texture( godotLightmap, vec3( p3, uvw.z ) ).rgb ) );
}

vec3 godotLightmapTexel( vec3 uvw ) {
	return godotLightmapUsesBicubic ? godotLightmapBicubic( uvw ) : textureLod( godotLightmap, uvw, 0.0 ).rgb;
}

vec3 godotLightmapAmbient( vec3 worldNormal ) {
	vec3 uvw = vec3( vGodotLightmapUv * godotLightmapUvScale.zw + godotLightmapUvScale.xy, godotLightmapSlice );
	if ( ! godotLightmapUsesSH ) return godotLightmapTexel( uvw );
	uvw.z *= 4.0;
	vec3 l0 = godotLightmapTexel( uvw );
	vec3 l1n1 = ( godotLightmapTexel( uvw + vec3( 0.0, 0.0, 1.0 ) ) - vec3( 0.5 ) ) * 2.0;
	vec3 l1z = ( godotLightmapTexel( uvw + vec3( 0.0, 0.0, 2.0 ) ) - vec3( 0.5 ) ) * 2.0;
	vec3 l1p1 = ( godotLightmapTexel( uvw + vec3( 0.0, 0.0, 3.0 ) ) - vec3( 0.5 ) ) * 2.0;
	vec3 n = normalize( godotLightmapNormalBasis * worldNormal );
	return l0 + l1n1 * n.y * ( l0 * 4.0 ) + l1z * n.z * ( l0 * 4.0 ) + l1p1 * n.x * ( l0 * 4.0 );
}`;

/** After three's maps have added the sky's irradiance, which the lightmap replaces. */
const LIGHTMAP_AMBIENT = /* glsl */ `${MAPS_ANCHOR}
if ( godotLightmapActive ) {
	irradiance = PI * godotLightmapAmbient( inverseTransformDirection( geometryNormal, viewMatrix ) );
	iblIrradiance = vec3( 0.0 );
}`;

/** Godot's UV2, three's `uv1`, which three declares only while a map reads it. */
const LIGHTMAP_UV_PARS = /* glsl */ `#include <uv_pars_vertex>
#ifndef USE_UV1
	attribute vec2 uv1;
#endif
varying vec2 vGodotLightmapUv;`;

const LIGHTMAP_UV = /* glsl */ `#include <uv_vertex>
vGodotLightmapUv = uv1;`;

/**
 * Each material's assignment. Written only by `bindLightmap`, and collected with its material. Not
 * `userData`, which a material's clone copies through JSON.
 */
const assignments = new WeakMap<Material, LightmapAssignment>();

/**
 * Whether a surface reads its lightmap: only a lit one, and only in the opaque pass, which is the
 * only pass that reads a lightmap (`render_forward_clustered.cpp:985-1003`).
 */
export function readsLightmap(isLit: boolean, isTransparent: boolean): boolean {
  return isLit && !isTransparent;
}

/** Gives `material` the lightmap it reads, or none. A rebind needs no recompile. */
export function bindLightmap(material: Material, assignment: LightmapAssignment | null): void {
  if (assignment) assignments.set(material, assignment);
  else assignments.delete(material);
}

/** Scratch for one upload: three reads each value as it uploads the material. */
const uvScale = new THREE.Vector4();
const textureSize = new THREE.Vector2();
const normalBasis = new THREE.Matrix3();

/** Uniforms that read `material`'s assignment at each upload, so a moved LightmapGI needs no remount. */
function lightmapUniforms(material: Material): Record<string, IUniform> {
  const bound = () => assignments.get(material);
  return {
    godotLightmapActive: {
      get value() {
        return bound()?.lightmap.isDrawn ?? false;
      },
    },
    // three binds its empty array texture for null.
    godotLightmap: {
      get value() {
        return bound()?.lightmap.atlas ?? null;
      },
    },
    godotLightmapUvScale: {
      get value() {
        const rect = bound()?.user.uvScale;
        return rect ? uvScale.set(rect.x, rect.y, rect.width, rect.height) : uvScale.set(0, 0, 0, 0);
      },
    },
    godotLightmapSlice: {
      get value() {
        return bound()?.user.sliceIndex ?? 0;
      },
    },
    godotLightmapUsesSH: {
      get value() {
        return bound()?.lightmap.usesSphericalHarmonics ?? false;
      },
    },
    godotLightmapUsesBicubic: {
      get value() {
        return bound()?.lightmap.usesBicubicFilter ?? false;
      },
    },
    godotLightmapTextureSize: {
      get value() {
        const image = bound()?.lightmap.atlas?.image;
        return image ? textureSize.set(image.width, image.height) : textureSize.set(1, 1);
      },
    },
    // `(L⁻¹ C)⁻ᵀ` on a view normal (`render_forward_clustered.cpp:1213-1215`) is `Lᵀ` on the world normal.
    godotLightmapNormalBasis: {
      get value() {
        const object = bound()?.lightmap.object;
        return object ? normalBasis.setFromMatrix4(object.matrixWorld).transpose() : normalBasis.identity();
      },
    },
  };
}

const LIGHTMAP_READ: ProgramInjection = {
  cacheKey: 'godot-lightmap-read',
  onBeforeCompile(shader) {
    Object.assign(shader.uniforms, lightmapUniforms(this));
    shader.vertexShader = shader.vertexShader
      .replace('#include <uv_pars_vertex>', LIGHTMAP_UV_PARS)
      .replace('#include <uv_vertex>', LIGHTMAP_UV);
    shader.fragmentShader = shader.fragmentShader
      .replace(PARS_ANCHOR, LIGHTMAP_PARS)
      .replace(MAPS_ANCHOR, LIGHTMAP_AMBIENT);
  },
};

/**
 * What a lightmapped lit material compiles with. `GODOT_LIGHTMAP` also turns on the Static light
 * skip (`lightBakeModeChunk.ts`) and the probe ambient guard.
 */
export const LIGHTMAP_PROGRAM: ProgramInjection = composeInjections([
  defining('GODOT_LIGHTMAP'),
  LIGHTMAP_READ,
])!;
