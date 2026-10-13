/**
 * How the sky lights a surface in Godot: its ambient light and its reflection. Both read Godot's
 * radiance layers, which `<SkyLayer>` shows in three shared cubes (`sky/skyLayersMap.ts`), and a
 * mirror reflection reads the radiance itself, mip 0 of three's PMREM
 * (`scene_forward_clustered.glsl:1704-1756`).
 */

import { applyChunkEdits, installChunkPatch, type ChunkEdit } from './shaderPatch/chunkPatch.js';
import { installLitUniform } from './shaderPatch/litUniform.js';
import { glslFloat } from '../resources/environment/glslLiterals.js';
import {
  SKY_CONTRIBUTION_UNIFORM,
  SKY_LAYER_UNIFORMS,
  skyContribution,
  skyLayerMaps,
} from './sky/skyLayersMap.js';
import { SKY_LAYER_GROUPS } from '../resources/sky/skyLayers.js';

type SkyChunk = 'lights_fragment_maps' | 'envmap_physical_pars_fragment';

const THREE_IBL_RADIANCE_FUNCTION =
  'vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {';

const { sharp, rough, last } = SKY_LAYER_GROUPS;

/**
 * Godot's sky ambient: its last radiance layer in the normal's direction, at the sky's share of the
 * ambient (`:1744-1756`), as irradiance. It scales by `envMapIntensity` and turns the same way as
 * three's `getIBLIrradiance`. A reflection takes the whole sky, whatever the share.
 */
const GODOT_IBL_IRRADIANCE = /* glsl */ `vec3 godotIBLIrradiance( const in vec3 normal ) {

		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		return PI * textureCube( ${SKY_LAYER_UNIFORMS.last}, envMapRotation * worldNormal ).rgb * envMapIntensity * ${SKY_CONTRIBUTION_UNIFORM}[ 0 ];

	}

	`;

/** A group's first layer and its last mip, as GLSL literals, for the read that clamps to them. */
function layerRange({ firstLayer, faceSizes }: { firstLayer: number; faceSizes: readonly number[] }) {
  return { first: glslFloat(firstLayer), lastMip: glslFloat(faceSizes.length - 1) };
}

const SHARP = layerRange(sharp);
const ROUGH = layerRange(rough);

/**
 * Godot's reflection of the sky. It bends the reflection towards the normal by the roughness
 * squared and dims what falls below the horizon (`:1704-1708`). It reads layer `sqrt( roughness )`
 * times the last layer's index and blends the two layers around it (`:1714-1721`). Each group's
 * cube clamps its read to its own layers, so the mix between two groups blends the last layer of
 * one with the first of the next, and a trilinear read inside a group is the blend.
 */
const GODOT_IBL_RADIANCE = /* glsl */ `vec3 godotIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {

		#ifdef ENVMAP_TYPE_CUBE_UV

			vec3 reflectVec = mix( reflect( - viewDir, normal ), normal, pow2( roughness ) );
			float horizon = min( 1.0 + dot( reflectVec, normal ), 1.0 );
			reflectVec = envMapRotation * transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			float layer = sqrt( roughness ) * ${glslFloat(last.firstLayer)};
			vec3 radiance = textureCubeUV( envMap, reflectVec, 0.0 ).rgb;
			vec3 sharpLayer = textureLod( ${SKY_LAYER_UNIFORMS.sharp}, reflectVec, clamp( layer - ${SHARP.first}, 0.0, ${SHARP.lastMip} ) ).rgb;
			vec3 roughLayer = textureLod( ${SKY_LAYER_UNIFORMS.rough}, reflectVec, clamp( layer - ${ROUGH.first}, 0.0, ${ROUGH.lastMip} ) ).rgb;
			vec3 lastLayer = textureCube( ${SKY_LAYER_UNIFORMS.last}, reflectVec ).rgb;
			vec3 reflection = mix( radiance, sharpLayer, clamp( layer, 0.0, 1.0 ) );
			reflection = mix( reflection, roughLayer, clamp( layer - ${glslFloat(rough.firstLayer - 1)}, 0.0, 1.0 ) );
			reflection = mix( reflection, lastLayer, clamp( layer - ${glslFloat(last.firstLayer - 1)}, 0.0, 1.0 ) );
			return reflection * envMapIntensity * horizon * horizon;

		#else

			return vec3( 0.0 );

		#endif

	}

	`;

/**
 * The share is a one-element array, not a float: three caches a float uniform by its value's
 * identity (r186 `WebGLUniforms.js:163-173`), so a rewritten buffer would never reach the GPU.
 */
const SKY_LAYER_DECLARATIONS = /* glsl */ `uniform samplerCube ${SKY_LAYER_UNIFORMS.sharp};
	uniform samplerCube ${SKY_LAYER_UNIFORMS.rough};
	uniform samplerCube ${SKY_LAYER_UNIFORMS.last};
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
    godot: `${SKY_LAYER_DECLARATIONS}${GODOT_IBL_IRRADIANCE}${GODOT_IBL_RADIANCE}${THREE_IBL_RADIANCE_FUNCTION}`,
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
  for (const group of ['sharp', 'rough', 'last'] as const) {
    installLitUniform(SKY_LAYER_UNIFORMS[group], skyLayerMaps[group]);
  }
  installLitUniform(SKY_CONTRIBUTION_UNIFORM, skyContribution);
}
