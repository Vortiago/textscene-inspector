/**
 * Godot's lightmap read in three's lit programs: a lightmapped surface's ambient is its texel of the
 * atlas, at its UV2 placed by its user rect and slice (`scene_forward_clustered.glsl:1835-1876`).
 * Scene and sky ambient give way to it (`:1739-1759`), and so does a ReflectionProbe's
 * (`probeShaderChunk.ts`). three's irradiance is Godot's ambient times PI. The bake's shadowmask
 * replaces or darkens a sun's real-time shadow at the same UV2 (`:2252-2273`, `:2483-2492`).
 */

import * as THREE from 'three';
import type { IUniform, Material } from 'three';
import { ShadowmaskMode } from '../../godot/scene/lightmapGi';
import { composeInjections, defining, type ProgramInjection } from '../materialProgramInputs';
import { editedProgram } from '../shaderPatch/chunkPatch';
import type { LightmapAssignment } from './sceneLightmaps';
import { bicubicFilterGlsl } from '../../utils/bicubicFilterGlsl';

/**
 * A light whose shadow opacity is at most this floor skips its shadow block, shadowmask included
 * (`scene_forward_clustered.glsl:2298`).
 */
const SHADOW_OPACITY_FLOOR = '0.001';

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
uniform highp sampler2DArray godotShadowmask;
uniform int godotShadowmaskMode;
varying vec2 vGodotLightmapUv;

${bicubicFilterGlsl({
  prefix: 'godotLightmap',
  params: 'vec3 uvw',
  uv: 'uvw.xy',
  size: 'godotLightmapTextureSize',
  fetch: (texelUv) => `texture( godotLightmap, vec3( ${texelUv}, uvw.z ) ).rgb`,
})}
vec3 godotLightmapTexel( vec3 uvw ) {
	return godotLightmapUsesBicubic ? godotLightmapBicubic( uvw ) : textureLod( godotLightmap, uvw, 0.0 ).rgb;
}

${bicubicFilterGlsl({
  prefix: 'godotShadowmask',
  params: 'vec3 uvw',
  uv: 'uvw.xy',
  // Godot sizes the mask with the lightmap's texture size (`scene_forward_clustered.glsl:2268`).
  size: 'godotLightmapTextureSize',
  fetch: (texelUv) => `vec3( texture( godotShadowmask, vec3( ${texelUv}, uvw.z ) ).r )`,
})}
vec3 godotLightmapUvw() {
	return vec3( vGodotLightmapUv * godotLightmapUvScale.zw + godotLightmapUvScale.xy, godotLightmapSlice );
}

vec3 godotLightmapAmbient( vec3 worldNormal ) {
	vec3 uvw = godotLightmapUvw();
	if ( ! godotLightmapUsesSH ) return godotLightmapTexel( uvw );
	uvw.z *= 4.0;
	vec3 l0 = godotLightmapTexel( uvw );
	vec3 l1n1 = ( godotLightmapTexel( uvw + vec3( 0.0, 0.0, 1.0 ) ) - vec3( 0.5 ) ) * 2.0;
	vec3 l1z = ( godotLightmapTexel( uvw + vec3( 0.0, 0.0, 2.0 ) ) - vec3( 0.5 ) ) * 2.0;
	vec3 l1p1 = ( godotLightmapTexel( uvw + vec3( 0.0, 0.0, 3.0 ) ) - vec3( 0.5 ) ) * 2.0;
	vec3 n = normalize( godotLightmapNormalBasis * worldNormal );
	return l0 + l1n1 * n.y * ( l0 * 4.0 ) + l1z * n.z * ( l0 * 4.0 ) + l1p1 * n.x * ( l0 * 4.0 );
}

float godotLightmapShadowmask() {
	vec3 uvw = godotLightmapUvw();
	return godotLightmapUsesBicubic ? godotShadowmaskBicubic( uvw ).x : textureLod( godotShadowmask, uvw, 0.0 ).x;
}

float godotShadowmaskReplace( float shadow, float shadowmask, float fadeOut, float opacity ) {
	return mix( shadow, mix( 1.0, shadowmask, opacity ), fadeOut );
}

float godotShadowmaskOverlay( float shadow, float shadowmask, float fadeOut, float opacity ) {
	float unshadowed = 1.0 - opacity;
	return unshadowed + shadowmask * ( ( 1.0 - fadeOut ) * ( shadow - unshadowed ) + opacity * fadeOut );
}

#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
float godotLightmapSunShadow( float shadow, float fadeOut, float opacity ) {
	if ( ! godotLightmapActive || godotShadowmaskMode == ${ShadowmaskMode.NONE} ) return godotSunShadowFaded( shadow, fadeOut );
	if ( opacity <= ${SHADOW_OPACITY_FLOOR} ) return 1.0;
	float shadowmask = godotLightmapShadowmask();
	return godotShadowmaskMode == ${ShadowmaskMode.REPLACE}
		? godotShadowmaskReplace( shadow, shadowmask, fadeOut, opacity )
		: godotShadowmaskOverlay( shadow, shadowmask, fadeOut, opacity );
}
#endif`;

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
    // three binds its empty array texture for null.
    godotShadowmask: {
      get value() {
        return bound()?.lightmap.shadowmaskAtlas ?? null;
      },
    },
    // A bake with no shadowmask binds Godot a white array, which mixes as None in both modes.
    godotShadowmaskMode: {
      get value() {
        return bound()?.lightmap.shadowmaskMode ?? ShadowmaskMode.NONE;
      },
    },
  };
}

const LIGHTMAP_READ: ProgramInjection = {
  cacheKey: 'godot-lightmap-read',
  onBeforeCompile(shader) {
    Object.assign(shader.uniforms, lightmapUniforms(this));
    editedProgram(
      shader,
      {
        vertex: [
          { three: '#include <uv_pars_vertex>', godot: LIGHTMAP_UV_PARS },
          { three: '#include <uv_vertex>', godot: LIGHTMAP_UV },
        ],
        fragment: [
          { three: PARS_ANCHOR, godot: LIGHTMAP_PARS },
          { three: MAPS_ANCHOR, godot: LIGHTMAP_AMBIENT },
        ],
      },
      'lightmap read'
    );
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
