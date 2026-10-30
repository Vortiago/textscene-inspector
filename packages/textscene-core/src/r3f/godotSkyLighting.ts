/**
 * How the sky lights a surface in Godot: its ambient light and its reflection. Both read Godot's
 * radiance layers, which `<SkyLayer>` shows through one shared slot (`sky/skyRadiance.ts`), at the
 * mip the screen derivatives of the direction pick (`scene_forward_clustered.glsl:1704-1756`).
 */

import { installChunkEdits, type ChunkEdit } from './shaderPatch/chunkPatch.js';
import { installLitUniform } from './shaderPatch/litUniform.js';
import { MAX_ROUGHNESS_LOD } from '../godot/rendering/environment/skyReflection.js';
import { glslFloat } from '../utils/glslLiterals.js';
import { SKY_RADIANCE_GLSL, SKY_RADIANCE_UNIFORMS, skyRadianceUniforms } from './sky/skyRadiance.js';

type SkyChunk = 'lights_fragment_maps' | 'envmap_physical_pars_fragment';

/** The signature of three's reflection, before which a patch declares its helpers. */
export const THREE_IBL_RADIANCE_FUNCTION =
  'vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {';

const { rotation } = SKY_RADIANCE_UNIFORMS;
const LAST_LAYER = glslFloat(MAX_ROUGHNESS_LOD);

/**
 * Godot's sky ambient: its last radiance layer in the normal's direction, at the sky's share of the
 * ambient (`:1744-1756`), as irradiance, in the sky's space. It scales by `envMapIntensity`. A
 * reflection takes the whole sky, whatever the share.
 */
const GODOT_IBL_IRRADIANCE = /* glsl */ `vec3 godotIBLIrradiance( const in vec3 normal ) {

		vec3 ambientDir = ${rotation} * ( vec4( normal, 0.0 ) * viewMatrix ).xyz;
		return PI * godotSkyReadAlong( ambientDir, ${LAST_LAYER}, godotSkyLod( ambientDir ) ) * envMapIntensity * GODOT_SKY_CONTRIBUTION;

	}

	`;

/**
 * Godot's radiance layer `sqrt( roughness )` times the last layer's index, in the sky-space direction
 * `reflectVec`, blending the two layers around it (`:1714-1721`). It scales by `envMapIntensity`.
 */
const GODOT_SKY_LAYER = /* glsl */ `vec3 godotSkyLayer( const in vec3 reflectVec, const in float roughness ) {

		return godotSkyBlend( reflectVec, sqrt( roughness ) * ${LAST_LAYER} ) * envMapIntensity;

	}

	`;

/**
 * Godot's reflection direction in the sky's space (`:1704-1708`): the view reflected about `normal`, bent
 * towards it by the roughness squared. The caller dims it by `horizon` squared, which falls below
 * the horizon of `surfaceNormal`: the clearcoat's reflection takes it from the surface under the coat.
 * It stays unnormalised, as Godot's does, since its derivatives pick the mip.
 */
const GODOT_REFLECTION = /* glsl */ `vec3 godotReflection( const in vec3 viewDir, const in vec3 normal, const in vec3 surfaceNormal, const in float roughness, out float horizon ) {

		vec3 reflectVec = mix( reflect( - viewDir, normal ), normal, pow2( roughness ) );
		horizon = min( 1.0 + dot( reflectVec, surfaceNormal ), 1.0 );
		return ${rotation} * ( vec4( reflectVec, 0.0 ) * viewMatrix ).xyz;

	}

	`;

/** Godot's reflection of the sky. */
const GODOT_IBL_RADIANCE = /* glsl */ `vec3 godotIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {

		float horizon;
		vec3 reflectVec = godotReflection( viewDir, normal, normal, roughness, horizon );
		return godotSkyLayer( reflectVec, roughness ) * horizon * horizon;

	}

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
    godot: `${SKY_RADIANCE_GLSL}${GODOT_IBL_IRRADIANCE}${GODOT_SKY_LAYER}${GODOT_REFLECTION}${GODOT_IBL_RADIANCE}${THREE_IBL_RADIANCE_FUNCTION}`,
  },
  {
    chunk: 'envmap_physical_pars_fragment',
    three: 'return getIBLRadiance( viewDir, bentNormal, roughness );',
    godot: 'return godotIBLRadiance( viewDir, bentNormal, roughness );',
  },
];

/**
 * Replaces three's chunks and gives the layer slot and the shown sky to every built-in lit
 * material and to `UniformsLib.lights`, for every program compiled after the call. A three release
 * that rewrites a replaced line keeps all its chunks, and `godotSkyLighting.test.ts` fails on that
 * release. True when the chunks hold the patch after the call. A second call changes nothing.
 */
export function installGodotSkyLighting(): boolean {
  const isPatched = installChunkEdits({
    edits: SKY_LIGHTING_EDITS,
    mark: GODOT_IBL_RADIANCE,
    patch: 'sky lighting',
  });
  if (!isPatched) return false;
  for (const [name, { value }] of Object.entries(skyRadianceUniforms())) installLitUniform(name, value);
  return true;
}
