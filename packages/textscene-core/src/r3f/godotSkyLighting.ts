/**
 * How the sky lights a surface in Godot: its ambient light and its reflection. Both read Godot's
 * roughest radiance layers, which `<SkyLayer>` shows in two shared cubes (`sky/skyLayersMap.ts`):
 * three's PMREM blurs a rough layer narrower than Godot's chain of downsamples, and so draws a
 * horizon-bright sky's ambient about 3% dark. A sharper reflection reads the PMREM as Godot reads
 * its radiance layers (`scene_forward_clustered.glsl:1704-1734`).
 */

import { applyChunkEdits, installChunkPatch, type ChunkEdit } from './shaderPatch/chunkPatch.js';
import { installLitUniform } from './shaderPatch/litUniform.js';
import { glslFloat } from '../resources/environment/glslLiterals.js';
import {
  SKY_CONTRIBUTION_UNIFORM,
  SKY_LAST_LAYER_UNIFORM,
  SKY_ROUGH_LAYERS_UNIFORM,
  skyContribution,
  skyLastLayerMap,
  skyRoughLayersMap,
} from './sky/skyLayersMap.js';
import { SKY_ROUGHNESS_LAYERS_DEFAULT } from '../godot/skyReflection.js';
import { FIRST_BAKED_LAYER } from '../resources/sky/skyLayers.js';

type SkyChunk = 'lights_fragment_maps' | 'envmap_physical_pars_fragment';

const THREE_IBL_RADIANCE_FUNCTION =
  'vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {';

const LAST_LAYER = SKY_ROUGHNESS_LAYERS_DEFAULT - 1;

/**
 * Godot's sky ambient: its last radiance layer in the normal's direction, at the sky's share of the
 * ambient (`:1744-1756`), as irradiance. It scales by `envMapIntensity` and turns the same way as
 * three's `getIBLIrradiance`. A reflection takes the whole sky, whatever the share.
 */
const GODOT_IBL_IRRADIANCE = /* glsl */ `vec3 godotIBLIrradiance( const in vec3 normal ) {

		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		return PI * textureCube( ${SKY_LAST_LAYER_UNIFORM}, envMapRotation * worldNormal ).rgb * envMapIntensity * ${SKY_CONTRIBUTION_UNIFORM}[ 0 ];

	}

	`;

/**
 * three's PMREM blurs a roughness wider than Godot's radiance layer at its square root
 * (`scene_forward_clustered.glsl:1714-1725`). Read at this power of the roughness, the PMREM
 * comes closest to Godot's layers 1 to 3 on metal spheres.
 */
const PMREM_ROUGHNESS_EXPONENT = 0.8;

/** The rough cube's last mip, which holds the layer before the last. */
const LAST_ROUGH_MIP = LAST_LAYER - 1 - FIRST_BAKED_LAYER;

/** The roughness whose reflection reads Godot's layer just below the first baked one alone. */
const LAST_PMREM_ROUGHNESS = ((FIRST_BAKED_LAYER - 1) / LAST_LAYER) ** 2;

/**
 * Godot's radiance layer below the first baked one, read from the PMREM, in the world direction
 * `reflectVec`. A roughness below `LAST_PMREM_ROUGHNESS` reads no baked layer, so this alone is its
 * layer. The caller scales it by `envMapIntensity`.
 */
const GODOT_PMREM_LAYER = /* glsl */ `vec3 godotPmremLayer( const in vec3 reflectVec, const in float roughness ) {

		#ifdef ENVMAP_TYPE_CUBE_UV

			return textureCubeUV( envMap, reflectVec, pow( min( roughness, ${glslFloat(LAST_PMREM_ROUGHNESS)} ), ${glslFloat(PMREM_ROUGHNESS_EXPONENT)} ) ).rgb;

		#else

			return vec3( 0.0 );

		#endif

	}

	`;

/**
 * Godot's radiance layer `sqrt( roughness )` times the last layer's index, in the world direction
 * `reflectVec`, blending the two layers around it (`:1714-1721`): the PMREM below the first baked
 * layer, the rough cube's mips from there, where a trilinear read is that blend, and the last
 * layer's cube at the top. It scales by `envMapIntensity`.
 */
const GODOT_SKY_LAYER = /* glsl */ `vec3 godotSkyLayer( const in vec3 reflectVec, const in float roughness ) {

		#ifdef ENVMAP_TYPE_CUBE_UV

			float layer = sqrt( roughness ) * ${glslFloat(LAST_LAYER)};
			vec3 roughLayer = textureLod( ${SKY_ROUGH_LAYERS_UNIFORM}, reflectVec, clamp( layer - ${glslFloat(FIRST_BAKED_LAYER)}, 0.0, ${glslFloat(LAST_ROUGH_MIP)} ) ).rgb;
			vec3 lastLayer = textureCube( ${SKY_LAST_LAYER_UNIFORM}, reflectVec ).rgb;
			vec3 bakedLayer = mix( roughLayer, lastLayer, clamp( layer - ${glslFloat(LAST_LAYER - 1)}, 0.0, 1.0 ) );
			float bakedShare = clamp( layer - ${glslFloat(FIRST_BAKED_LAYER - 1)}, 0.0, 1.0 );
			return mix( godotPmremLayer( reflectVec, roughness ), bakedLayer, bakedShare ) * envMapIntensity;

		#else

			return vec3( 0.0 );

		#endif

	}

	`;

/**
 * Godot's reflection direction in the world (`:1704-1708`): the view reflected about `normal`, bent
 * towards it by the roughness squared. The caller dims it by `horizon` squared, which falls below
 * the horizon of `surfaceNormal`: the clearcoat's reflection takes it from the surface under the coat.
 */
const GODOT_REFLECTION = /* glsl */ `vec3 godotReflection( const in vec3 viewDir, const in vec3 normal, const in vec3 surfaceNormal, const in float roughness, out float horizon ) {

		vec3 reflectVec = mix( reflect( - viewDir, normal ), normal, pow2( roughness ) );
		horizon = min( 1.0 + dot( reflectVec, surfaceNormal ), 1.0 );
		return envMapRotation * transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );

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
 * The share is a one-element array, not a float: three caches a float uniform by its value's
 * identity (r186 `WebGLUniforms.js:163-173`), so a rewritten buffer would never reach the GPU.
 */
const SKY_LAYER_UNIFORMS = /* glsl */ `uniform samplerCube ${SKY_ROUGH_LAYERS_UNIFORM};
	uniform samplerCube ${SKY_LAST_LAYER_UNIFORM};
	uniform float ${SKY_CONTRIBUTION_UNIFORM}[ 1 ];

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
    godot: `${SKY_LAYER_UNIFORMS}${GODOT_IBL_IRRADIANCE}${GODOT_PMREM_LAYER}${GODOT_SKY_LAYER}${GODOT_REFLECTION}${GODOT_IBL_RADIANCE}${THREE_IBL_RADIANCE_FUNCTION}`,
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
 * Replaces three's chunks and gives the layer cubes and the sky's share to every built-in lit material and to
 * `UniformsLib.lights`, for every program compiled after the call. A three release that rewrites a
 * replaced line keeps all its chunks, and `godotSkyLighting.test.ts` fails on that release. A
 * second call changes nothing.
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
  installLitUniform(SKY_ROUGH_LAYERS_UNIFORM, skyRoughLayersMap);
  installLitUniform(SKY_LAST_LAYER_UNIFORM, skyLastLayerMap);
  installLitUniform(SKY_CONTRIBUTION_UNIFORM, skyContribution);
}
