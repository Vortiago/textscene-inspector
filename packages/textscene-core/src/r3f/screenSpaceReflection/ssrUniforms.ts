/**
 * What every lit program reads of the screen-space reflection (`ssrSceneChunk.ts`): the reflection
 * of the render that draws, the best-fit normal table the normal-roughness prepass encodes with, and
 * the state of the pass. Each render that traces shows its own reflection, and none after.
 */

import * as THREE from 'three';
import { installedSlot } from '../sharedTexture.js';
import { installedOr } from '../shaderPatch/litUniform.js';

export const SSR_UNIFORM = {
  reflection: 'godotSsrReflection',
  bestFitNormals: 'godotBestFitNormals',
  state: 'godotSsrState',
} as const;

/**
 * The full-size reflection a lit material reads at its own pixel: premultiplied, with the tone map
 * of the trace undone. three never uploads the slot and binds whatever handle it holds.
 */
export const reflectionSlot = installedSlot(SSR_UNIFORM.reflection, THREE.Texture);

/** Godot's best-fit normal length table (`best_fit_normal.glsl`), read at the nearest texel. */
export const bestFitNormalsSlot = installedSlot(SSR_UNIFORM.bestFitNormals, THREE.Texture);

/**
 * Written only by the reflection pass: x is 1 while the normal-roughness prepass draws, y is 1
 * while a render shows its reflection, and z is the alpha below which the prepass cuts a surface.
 * A typed array, which `cloneUniforms` keeps by reference, so every material reads this buffer.
 */
export const ssrState = installedOr(SSR_UNIFORM.state, Float32Array, () => new Float32Array(4));

/** The components of {@link ssrState}, which the programs read as x, y and z. */
export const SSR_STATE = { drawsNormalRoughness: 0, showsReflection: 1, prepassCut: 2 } as const;
