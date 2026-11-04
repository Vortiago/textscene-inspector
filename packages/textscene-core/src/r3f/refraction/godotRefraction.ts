/**
 * Godot's refraction blur in three's transmission. Godot reads the screen at lod `ROUGHNESS * 8.0`
 * with a trilinear read (`material.cpp:1830`). three scales its lod by the screen's width and the
 * IOR, reads its own floored roughness, and filters bicubic.
 */

import { installChunkEdits, type ChunkEdit } from '../shaderPatch/chunkPatch.js';

type RefractionChunk = 'transmission_pars_fragment' | 'transmission_fragment';

const GODOT_REFRACTION_SAMPLE = 'return textureLod( transmissionSamplerMap, fragCoord.xy, roughness * 8.0 );';

/**
 * `ROUGHNESS` as Godot's refraction reads it: the material's roughness as the fragment writes it,
 * before the limiter and before the decals mix theirs in (`scene_forward_clustered.glsl:1635`).
 */
const MATERIAL_ROUGHNESS = 'godotRefractionRoughness';

const CAPTURED_ROUGHNESS = /* glsl */ `
#ifdef USE_TRANSMISSION
	float ${MATERIAL_ROUGHNESS} = roughnessFactor;
#endif
`;

/**
 * The blur takes its own roughness, so three's Fresnel on the refraction keeps `material.roughness`.
 */
const REFRACTION_EDITS: readonly ChunkEdit<RefractionChunk>[] = [
  {
    chunk: 'transmission_pars_fragment',
    three: 'float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );',
    godot: '',
  },
  {
    chunk: 'transmission_pars_fragment',
    three: 'return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );',
    godot: GODOT_REFRACTION_SAMPLE,
  },
  {
    chunk: 'transmission_pars_fragment',
    three: 'const in float roughness, const in vec3 diffuseColor,',
    godot: `const in float roughness, const in float ${MATERIAL_ROUGHNESS}, const in vec3 diffuseColor,`,
  },
  {
    chunk: 'transmission_pars_fragment',
    three: 'getTransmissionSample( refractionCoords, roughness, iors[ i ] );',
    godot: `getTransmissionSample( refractionCoords, ${MATERIAL_ROUGHNESS}, iors[ i ] );`,
  },
  {
    chunk: 'transmission_pars_fragment',
    three: 'getTransmissionSample( refractionCoords, roughness, ior );',
    godot: `getTransmissionSample( refractionCoords, ${MATERIAL_ROUGHNESS}, ior );`,
  },
  {
    chunk: 'transmission_fragment',
    three: 'n, v, material.roughness,',
    godot: `n, v, material.roughness, ${MATERIAL_ROUGHNESS},`,
  },
];

/** Replaces three's refraction blur with Godot's. A second call changes nothing. */
export function installGodotRefraction(): boolean {
  return installChunkEdits({
    edits: REFRACTION_EDITS,
    append: { roughnessmap_fragment: CAPTURED_ROUGHNESS },
    mark: GODOT_REFRACTION_SAMPLE,
    patch: 'refraction',
  });
}
