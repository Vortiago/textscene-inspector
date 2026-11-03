/**
 * Godot's refraction blur in three's transmission. Godot reads the screen at lod `ROUGHNESS * 8.0`
 * with a trilinear read (`material.cpp:1830`). three scales its lod by the screen's width and the
 * IOR, reads its own floored roughness, and filters bicubic.
 */

import { installChunkEdits, type ChunkEdit } from '../shaderPatch/chunkPatch.js';

type RefractionChunk = 'transmission_pars_fragment' | 'transmission_fragment';

const GODOT_REFRACTION_SAMPLE = 'return textureLod( transmissionSamplerMap, fragCoord.xy, roughness * 8.0 );';

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
    // `ROUGHNESS` is the material's roughness as the fragment writes it, before the limiter.
    chunk: 'transmission_fragment',
    three: 'n, v, material.roughness,',
    godot: 'n, v, roughnessFactor,',
  },
];

/** Replaces three's refraction blur with Godot's. A second call changes nothing. */
export function installGodotRefraction(): boolean {
  return installChunkEdits({ edits: REFRACTION_EDITS, mark: GODOT_REFRACTION_SAMPLE, patch: 'refraction' });
}
