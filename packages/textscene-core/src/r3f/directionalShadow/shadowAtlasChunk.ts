/**
 * One sampler for every sun shadow, as Godot samples one directional shadow atlas for every
 * directional light (`scene_forward_clustered.glsl:2443`). three r186 declares a sampler, and so a
 * texture unit, per sun shadow. `directionalShadow.md` beside this file has the design.
 */

import {
  applyChunkEdits,
  installChunkPatch,
  type ChunkEdit,
  type Chunks,
} from '../shaderPatch/chunkPatch.js';
import { installLitUniform } from '../shaderPatch/litUniform.js';
import { DIRECTIONAL_SHADOW_ATLAS_UNIFORM, directionalShadowAtlasDepth } from './shadowAtlas.js';

/** The chunks that declare and sample a sun shadow: the lit materials' and `ShadowMaterial`'s. */
type AtlasChunkName = 'shadowmap_pars_fragment' | 'lights_fragment_begin' | 'shadowmask_pars_fragment';

export type ShadowAtlasChunks = Chunks<AtlasChunkName>;

/**
 * three's per-shadow sampler, of the type a shadow map type takes (`shadowmap_pars_fragment.glsl.js:24-28`),
 * declared for the one atlas instead. One sampler, not a cap on suns tied to the material's own
 * samplers: a cap drops shadows Godot draws, and three sets up one light state for every material in
 * a render.
 */
function atlasSampler(type: 'sampler2DShadow' | 'sampler2D'): ChunkEdit<AtlasChunkName> {
  return {
    chunk: 'shadowmap_pars_fragment',
    three: `uniform ${type} sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];`,
    godot: `uniform ${type} ${DIRECTIONAL_SHADOW_ATLAS_UNIFORM};`,
  };
}

/** The sampler argument of the sun shadow lookup in a chunk that calls it. */
function atlasSample(chunk: AtlasChunkName): ChunkEdit<AtlasChunkName> {
  return {
    chunk,
    three: 'getSunShadow( sunShadowMap[ i ],',
    godot: `getSunShadow( ${DIRECTIONAL_SHADOW_ATLAS_UNIFORM},`,
  };
}

/** Each edit. Each `three` text occurs once in its chunk. */
export const SHADOW_ATLAS_EDITS: readonly ChunkEdit<AtlasChunkName>[] = [
  atlasSampler('sampler2DShadow'),
  atlasSampler('sampler2D'),
  atlasSample('lights_fragment_begin'),
  atlasSample('shadowmask_pars_fragment'),
];

/** The chunks with one atlas sampler, or null when any lacks a line the patch replaces. */
export function shadowAtlasChunks(chunks: ShadowAtlasChunks): ShadowAtlasChunks | null {
  return applyChunkEdits(chunks, SHADOW_ATLAS_EDITS);
}

/**
 * Patches three's chunks and gives the atlas uniform to every built-in lit material and to
 * `UniformsLib.lights`, for every program compiled after the call. A three release that rewrites a
 * replaced line keeps its own chunks, and `shadowAtlasChunk.test.ts` fails on that release.
 */
export function installDirectionalShadowAtlas(): void {
  const isPatched = installChunkPatch({
    names: ['shadowmap_pars_fragment', 'lights_fragment_begin', 'shadowmask_pars_fragment'],
    isApplied: (chunks) => chunks.shadowmap_pars_fragment.includes(DIRECTIONAL_SHADOW_ATLAS_UNIFORM),
    apply: shadowAtlasChunks,
    missing: 'sun shadow chunks have no per-shadow sampler to replace',
  });
  if (isPatched) installLitUniform(DIRECTIONAL_SHADOW_ATLAS_UNIFORM, directionalShadowAtlasDepth());
}
