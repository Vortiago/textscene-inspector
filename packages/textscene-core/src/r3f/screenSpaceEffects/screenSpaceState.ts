/**
 * What every lit program reads of the screen-space effects: the state of the passes, and the
 * best-fit normal table the normal-roughness prepass encodes with. Each render that runs an effect
 * shows its own result, and none after.
 */

import * as THREE from 'three';
import { installedSlot } from '../sharedTexture.js';
import { installedOr } from '../shaderPatch/litUniform.js';

export const SCREEN_SPACE_UNIFORM = {
  bestFitNormals: 'godotBestFitNormals',
  state: 'godotScreenSpaceState',
} as const;

/** Godot's best-fit normal length table (`best_fit_normal.glsl`), read at the nearest texel. */
export const bestFitNormalsSlot = installedSlot(SCREEN_SPACE_UNIFORM.bestFitNormals, THREE.Texture);

/**
 * Written only by `SceneScreenSpaceEffects` and the prepass. A typed array, which `cloneUniforms`
 * keeps by reference, so every material reads this buffer.
 */
export const screenSpaceState = installedOr(
  SCREEN_SPACE_UNIFORM.state,
  Float32Array,
  () => new Float32Array(4)
);

/**
 * The components of {@link screenSpaceState}, which the programs read as x, y, z and w: 1 while the
 * normal-roughness prepass draws, 1 while a render shows its reflection, the alpha below which the
 * prepass cuts a surface, and 1 while a render shows its ambient occlusion.
 */
export const SCREEN_SPACE_STATE = {
  drawsNormalRoughness: 0,
  showsReflection: 1,
  prepassCut: 2,
  showsOcclusion: 3,
} as const;
