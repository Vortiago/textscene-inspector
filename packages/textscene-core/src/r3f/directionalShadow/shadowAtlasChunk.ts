/**
 * One sampler for every sun shadow, as Godot samples one directional shadow atlas for every
 * directional light (`scene_forward_clustered.glsl:2443`). three r186 declares a sampler, and so a
 * texture unit, per sun shadow. `directionalShadow.md` beside this file has the design.
 */

import * as THREE from 'three';
import { warn } from '../../logger.js';
import { DIRECTIONAL_SHADOW_ATLAS_UNIFORM, directionalShadowAtlasDepth } from './shadowAtlas.js';

const PARS_CHUNK = 'shadowmap_pars_fragment';
/** The chunks that sample a sun shadow: the lit materials' and `ShadowMaterial`'s. */
const LIGHTS_CHUNK = 'lights_fragment_begin';
const SHADOW_MASK_CHUNK = 'shadowmask_pars_fragment';

/**
 * three's per-shadow samplers, one for each shadow map type (`shadowmap_pars_fragment.glsl.js:24-28`).
 * One sampler, not a cap on suns tied to the material's own samplers: a cap drops shadows Godot
 * draws, and three sets up one light state for every material in a render.
 */
const THREE_SAMPLERS = [
  'uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];',
  'uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];',
];

/** The sampler argument of each sun shadow lookup, in both chunks that call it. */
const THREE_SAMPLE = 'getSunShadow( sunShadowMap[ i ],';
const ATLAS_SAMPLE = `getSunShadow( ${DIRECTIONAL_SHADOW_ATLAS_UNIFORM},`;

export interface ShadowAtlasChunks {
  pars: string;
  lights: string;
  shadowMask: string;
}

/** The chunks with one atlas sampler, or null when any lacks a line the patch replaces. */
export function shadowAtlasChunks(chunks: ShadowAtlasChunks): ShadowAtlasChunks | null {
  const { pars, lights, shadowMask } = chunks;
  if (!THREE_SAMPLERS.every((sampler) => pars.includes(sampler))) return null;
  if (!lights.includes(THREE_SAMPLE) || !shadowMask.includes(THREE_SAMPLE)) return null;
  return {
    pars: THREE_SAMPLERS.reduce((chunk, sampler) => chunk.replace(sampler, atlasSampler(sampler)), pars),
    lights: lights.replaceAll(THREE_SAMPLE, ATLAS_SAMPLE),
    shadowMask: shadowMask.replaceAll(THREE_SAMPLE, ATLAS_SAMPLE),
  };
}

/** three's declaration, of the same sampler type, for the one atlas. */
function atlasSampler(threeSampler: string): string {
  return threeSampler.replace('sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ]', DIRECTIONAL_SHADOW_ATLAS_UNIFORM);
}

/**
 * Patches three's chunks and gives the atlas uniform to every built-in lit material and to
 * `UniformsLib.lights`, for every program compiled after the call. A three release that rewrites a
 * replaced line keeps its own chunks, and `shadowAtlasChunk.test.ts` fails on that release.
 */
export function installDirectionalShadowAtlas(): void {
  if (THREE.ShaderChunk[PARS_CHUNK].includes(DIRECTIONAL_SHADOW_ATLAS_UNIFORM)) return;
  const patched = shadowAtlasChunks({
    pars: THREE.ShaderChunk[PARS_CHUNK],
    lights: THREE.ShaderChunk[LIGHTS_CHUNK],
    shadowMask: THREE.ShaderChunk[SHADOW_MASK_CHUNK],
  });
  if (patched === null) {
    warn(`[Shading] three's sun shadow chunks have no per-shadow sampler to replace`);
    return;
  }
  THREE.ShaderChunk[PARS_CHUNK] = patched.pars;
  THREE.ShaderChunk[LIGHTS_CHUNK] = patched.lights;
  THREE.ShaderChunk[SHADOW_MASK_CHUNK] = patched.shadowMask;
  const uniform = () => ({ value: directionalShadowAtlasDepth() });
  for (const shader of Object.values(THREE.ShaderLib)) {
    if ('sunLightShadows' in shader.uniforms) shader.uniforms[DIRECTIONAL_SHADOW_ATLAS_UNIFORM] = uniform();
  }
  (THREE.UniformsLib.lights as Record<string, THREE.IUniform>)[DIRECTIONAL_SHADOW_ATLAS_UNIFORM] = uniform();
}
