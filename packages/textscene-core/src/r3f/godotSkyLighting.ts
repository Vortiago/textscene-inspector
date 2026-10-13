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
		return PI * textureCube( ${SKY_LAST_LAYER_UNIFORM}, envMapRotation * worldNormal ).rgb * envMapIntensity * ${SKY_CONTRIBUTION_UNIFORM}.x;

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
 * Godot's reflection of the sky. It bends the reflection towards the normal by the roughness
 * squared and dims what falls below the horizon (`:1704-1708`). It reads layer `sqrt( roughness )`
 * times the last layer's index and blends the two layers around it (`:1714-1721`): the PMREM below
 * the first baked layer, the rough cube's mips from there, where a trilinear read is that blend, and
 * the last layer's cube at the top.
 */
const GODOT_IBL_RADIANCE = /* glsl */ `vec3 godotIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {

		#ifdef ENVMAP_TYPE_CUBE_UV

			vec3 reflectVec = mix( reflect( - viewDir, normal ), normal, pow2( roughness ) );
			float horizon = min( 1.0 + dot( reflectVec, normal ), 1.0 );
			reflectVec = envMapRotation * transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			float layer = sqrt( roughness ) * ${glslFloat(LAST_LAYER)};
			vec3 pmremLayer = textureCubeUV( envMap, reflectVec, pow( min( roughness, ${glslFloat(LAST_PMREM_ROUGHNESS)} ), ${glslFloat(PMREM_ROUGHNESS_EXPONENT)} ) ).rgb;
			vec3 roughLayer = textureLod( ${SKY_ROUGH_LAYERS_UNIFORM}, reflectVec, clamp( layer - ${glslFloat(FIRST_BAKED_LAYER)}, 0.0, ${glslFloat(LAST_ROUGH_MIP)} ) ).rgb;
			vec3 lastLayer = textureCube( ${SKY_LAST_LAYER_UNIFORM}, reflectVec ).rgb;
			vec3 bakedLayer = mix( roughLayer, lastLayer, clamp( layer - ${glslFloat(LAST_LAYER - 1)}, 0.0, 1.0 ) );
			float bakedShare = clamp( layer - ${glslFloat(FIRST_BAKED_LAYER - 1)}, 0.0, 1.0 );
			return mix( pmremLayer, bakedLayer, bakedShare ) * envMapIntensity * horizon * horizon;

		#else

			return vec3( 0.0 );

		#endif

	}

	`;

const SKY_LAYER_UNIFORMS = /* glsl */ `uniform samplerCube ${SKY_ROUGH_LAYERS_UNIFORM};
	uniform samplerCube ${SKY_LAST_LAYER_UNIFORM};
	uniform vec2 ${SKY_CONTRIBUTION_UNIFORM};

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
    godot: `${SKY_LAYER_UNIFORMS}${GODOT_IBL_IRRADIANCE}${GODOT_IBL_RADIANCE}${THREE_IBL_RADIANCE_FUNCTION}`,
  },
  {
    chunk: 'envmap_physical_pars_fragment',
    three: 'return getIBLRadiance( viewDir, bentNormal, roughness );',
    godot: 'return godotIBLRadiance( viewDir, bentNormal, roughness );',
  },
];

/**
 * Replaces three's chunks and gives the layer cubes and the sky's share to every built-in lit material and to
 * `UniformsLib.lights`, for every program compiled after the call. A three release that rewrites a
 * replaced line keeps all its chunks, and `godotSkyLighting.test.ts` fails on that release. A
 * second call changes nothing.
 */
export function installGodotSkyLighting(): void {
  const isPatched = installChunkPatch({
    names: ['lights_fragment_maps', 'envmap_physical_pars_fragment'],
    isApplied: (chunks) => chunks.envmap_physical_pars_fragment.includes(GODOT_IBL_RADIANCE),
    apply: (chunks) => applyChunkEdits(chunks, SKY_LIGHTING_EDITS),
    missing:
      'lights_fragment_maps or envmap_physical_pars_fragment lacks a line the sky lighting patch replaces',
  });
  if (!isPatched) return;
  installLitUniform(SKY_ROUGH_LAYERS_UNIFORM, skyRoughLayersMap);
  installLitUniform(SKY_LAST_LAYER_UNIFORM, skyLastLayerMap);
  installLitUniform(SKY_CONTRIBUTION_UNIFORM, skyContribution);
}
