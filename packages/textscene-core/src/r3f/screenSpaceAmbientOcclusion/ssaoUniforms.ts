/**
 * What every lit program reads of the screen-space ambient occlusion (`ssaoSceneChunk.ts`): the
 * occlusion of the render that draws, and how far it reaches into the direct light.
 */

import * as THREE from 'three';
import type { ScreenSpaceAmbientOcclusion } from '../../resources/environment/types.js';
import { installedSlot, showInSlot } from '../sharedTexture.js';
import { installedOr } from '../shaderPatch/litUniform.js';
import { SCREEN_SPACE_STATE, screenSpaceState } from '../screenSpaceEffects/screenSpaceState.js';

export const SSAO_UNIFORM = { occlusion: 'godotSsaoOcclusion', fold: 'godotSsaoFold' } as const;

/**
 * The full-size occlusion a lit material reads at its own pixel, in Godot's rows. three never
 * uploads the slot and binds whatever handle it holds.
 */
export const occlusionSlot = installedSlot(SSAO_UNIFORM.occlusion, THREE.Texture);

/**
 * Written only by {@link showOcclusion}, and kept by reference in every material. Its components
 * are {@link SSAO_FOLD}'s.
 */
export const occlusionFold = installedOr(SSAO_UNIFORM.fold, Float32Array, () => new Float32Array(3));

/**
 * The components of {@link occlusionFold}, which the programs read as x, y and z: Godot's
 * `ssao_light_affect` and `ssao_ao_affect` (`render_forward_clustered.cpp:751-752`), and 1 while
 * the slot holds an occlusion. Godot binds its black default where none was drawn (`:3529-3530`).
 */
const SSAO_FOLD = { lightAffect: 0, aoChannelAffect: 1, hasOcclusion: 2 } as const;

/**
 * Shows `occlusion` to the lit programs that draw next, at the affects of `ssao`. A null
 * `occlusion` folds Godot's black default in.
 */
export function showOcclusion(
  renderer: THREE.WebGLRenderer,
  occlusion: THREE.Texture | null,
  ssao: ScreenSpaceAmbientOcclusion
): void {
  if (occlusion) showInSlot(renderer, occlusionSlot, occlusion);
  occlusionFold[SSAO_FOLD.lightAffect] = ssao.lightAffect;
  occlusionFold[SSAO_FOLD.aoChannelAffect] = ssao.aoChannelAffect;
  occlusionFold[SSAO_FOLD.hasOcclusion] = occlusion ? 1 : 0;
  screenSpaceState[SCREEN_SPACE_STATE.showsOcclusion] = 1;
}
