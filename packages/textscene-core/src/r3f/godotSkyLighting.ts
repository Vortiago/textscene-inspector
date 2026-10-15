/**
 * How the sky lights a surface in Godot: its ambient light and its reflection. Both read Godot's
 * radiance layers, which `<SkyLayer>` shows through one shared slot (`sky/skyLayerArray.ts`), at the
 * mip the screen derivatives of the direction pick (`scene_forward_clustered.glsl:1704-1756`).
 */

import { applyChunkEdits, installChunkPatch, type ChunkEdit } from './shaderPatch/chunkPatch.js';
import { installLitUniform } from './shaderPatch/litUniform.js';
import { MAX_ROUGHNESS_LOD } from '../godot/rendering/environment/skyReflection.js';
import { OCTMAP_GLSL } from '../resources/sky/skyLayerShaders.js';
import { glslFloat } from '../utils/glslLiterals.js';
import { SKY_UNIFORMS, shownSky, skyLayersSlot } from './sky/skyLayerArray.js';

type SkyChunk = 'lights_fragment_maps' | 'envmap_physical_pars_fragment';

/** The signature of three's reflection, before which a patch declares its helpers. */
export const THREE_IBL_RADIANCE_FUNCTION =
  'vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {';

const { layers, shown } = SKY_UNIFORMS;
const LAST_LAYER = glslFloat(MAX_ROUGHNESS_LOD);

/**
 * `vec3_to_oct_lod` (`oct_inc.glsl:43-51`): the mip whose texels span the octmap distance the
 * direction moves across a pixel, at most the array's last.
 */
const GODOT_SKY_LOD = /* glsl */ `float godotSkyLod( const in vec3 direction ) {

		vec3 directionDdx = dFdx( direction );
		vec3 directionDdy = dFdy( direction );
		float pixelSizeSqr = 4.0 * ${shown}[ 0 ].z * ${shown}[ 0 ].z;
		float ddx = dot( directionDdx, directionDdx ) / pixelSizeSqr;
		float ddy = dot( directionDdy, directionDdy ) / pixelSizeSqr;
		float lod = 0.25 * log2( max( ddx, ddy ) + 1e-6 );
		return min( lod, ${shown}[ 0 ].w );

	}

	`;

/** Radiance layer `layer` in the world direction `direction`, at mip `lod`. A layer past the last reads the last. */
const GODOT_SKY_READ = /* glsl */ `vec3 godotSkyRead( const in vec3 direction, const in float layer, const in float lod ) {

		return textureLod( ${layers}, vec3( vec3ToOctWithBorder( direction, ${shown}[ 0 ].y ), layer ), lod ).rgb;

	}

	`;

/**
 * Godot's sky ambient: its last radiance layer in the normal's direction, at the sky's share of the
 * ambient (`:1744-1756`), as irradiance. It scales by `envMapIntensity` and turns the same way as
 * three's `getIBLIrradiance`. A reflection takes the whole sky, whatever the share.
 */
const GODOT_IBL_IRRADIANCE = /* glsl */ `vec3 godotIBLIrradiance( const in vec3 normal ) {

		vec3 ambientDir = envMapRotation * ( vec4( normal, 0.0 ) * viewMatrix ).xyz;
		return PI * godotSkyRead( ambientDir, ${LAST_LAYER}, godotSkyLod( ambientDir ) ) * envMapIntensity * ${shown}[ 0 ].x;

	}

	`;

/**
 * Godot's radiance layer `sqrt( roughness )` times the last layer's index, in the world direction
 * `reflectVec`, blending the two layers around it (`:1714-1721`). It scales by `envMapIntensity`.
 */
const GODOT_SKY_LAYER = /* glsl */ `vec3 godotSkyLayer( const in vec3 reflectVec, const in float roughness ) {

		float roughnessLod;
		float blend = modf( sqrt( roughness ) * ${LAST_LAYER}, roughnessLod );
		float lod = godotSkyLod( reflectVec );
		vec3 sharper = godotSkyRead( reflectVec, roughnessLod, lod );
		vec3 rougher = godotSkyRead( reflectVec, roughnessLod + 1.0, lod );
		return mix( sharper, rougher, blend ) * envMapIntensity;

	}

	`;

/**
 * Godot's reflection direction in the world (`:1704-1708`): the view reflected about `normal`, bent
 * towards it by the roughness squared. The caller dims it by `horizon` squared, which falls below
 * the horizon of `surfaceNormal`: the clearcoat's reflection takes it from the surface under the coat.
 * It stays unnormalised, as Godot's does, since its derivatives pick the mip.
 */
const GODOT_REFLECTION = /* glsl */ `vec3 godotReflection( const in vec3 viewDir, const in vec3 normal, const in vec3 surfaceNormal, const in float roughness, out float horizon ) {

		vec3 reflectVec = mix( reflect( - viewDir, normal ), normal, pow2( roughness ) );
		horizon = min( 1.0 + dot( reflectVec, surfaceNormal ), 1.0 );
		return envMapRotation * ( vec4( reflectVec, 0.0 ) * viewMatrix ).xyz;

	}

	`;

/** Godot's reflection of the sky. */
const GODOT_IBL_RADIANCE = /* glsl */ `vec3 godotIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {

		float horizon;
		vec3 reflectVec = godotReflection( viewDir, normal, normal, roughness, horizon );
		return godotSkyLayer( reflectVec, roughness ) * horizon * horizon;

	}

	`;

/**
 * The shown sky is a one-element array, not a `vec4`: three caches a uniform by its value's identity
 * (r186 `WebGLUniforms.js:163-173`), so a rewritten buffer would never reach the GPU.
 */
const SKY_LAYER_DECLARATIONS = /* glsl */ `uniform highp sampler2DArray ${layers};
	uniform vec4 ${shown}[ 1 ];
	${OCTMAP_GLSL}
	`;

const SKY_LIGHTING_EDITS: readonly ChunkEdit<SkyChunk>[] = [
  {
    chunk: 'lights_fragment_maps',
    three: 'iblIrradiance += getIBLIrradiance( geometryNormal );',
    godot: 'iblIrradiance += godotIBLIrradiance( geometryNormal );',
  },
  {
    chunk: 'lights_fragment_maps',
    three: 'vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );',
    godot: 'vec3 iblRadiance = godotIBLRadiance( geometryViewDir, geometryNormal, material.godotRoughness );',
  },
  {
    chunk: 'envmap_physical_pars_fragment',
    three: THREE_IBL_RADIANCE_FUNCTION,
    godot: `${SKY_LAYER_DECLARATIONS}${GODOT_SKY_LOD}${GODOT_SKY_READ}${GODOT_IBL_IRRADIANCE}${GODOT_SKY_LAYER}${GODOT_REFLECTION}${GODOT_IBL_RADIANCE}${THREE_IBL_RADIANCE_FUNCTION}`,
  },
  {
    chunk: 'envmap_physical_pars_fragment',
    three: 'return getIBLRadiance( viewDir, bentNormal, roughness );',
    godot: 'return godotIBLRadiance( viewDir, bentNormal, roughness );',
  },
];

/** The text that proves the patch installed, which a patch that reads it requires. */
export const SKY_LIGHTING_MARK = GODOT_IBL_RADIANCE;

/**
 * Replaces three's chunks and gives the layer slot and the shown sky to every built-in lit
 * material and to `UniformsLib.lights`, for every program compiled after the call. A three release
 * that rewrites a replaced line keeps all its chunks, and `godotSkyLighting.test.ts` fails on that
 * release. A second call changes nothing.
 */
export function installGodotSkyLighting(): void {
  const isPatched = installChunkPatch({
    names: ['lights_fragment_maps', 'envmap_physical_pars_fragment'],
    isApplied: (chunks) => chunks.envmap_physical_pars_fragment.includes(SKY_LIGHTING_MARK),
    apply: (chunks) => applyChunkEdits(chunks, SKY_LIGHTING_EDITS),
    missing:
      'lights_fragment_maps or envmap_physical_pars_fragment lacks a line the sky lighting patch replaces',
  });
  if (!isPatched) return;
  installLitUniform(layers, skyLayersSlot);
  installLitUniform(shown, shownSky);
}
