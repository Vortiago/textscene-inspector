/**
 * The reflection every lit program reads of the screen-space reflection (`ssrSceneChunk.ts`): the
 * reflection of the render that draws.
 */

import * as THREE from 'three';
import { installedSlot, showInSlot } from '../sharedTexture.js';
import { SCREEN_SPACE_STATE, screenSpaceState } from '../screenSpaceEffects/screenSpaceState.js';

export const SSR_UNIFORM = { reflection: 'godotSsrReflection' } as const;

/**
 * The full-size reflection a lit material reads at its own pixel: premultiplied, with the tone map
 * of the trace undone. three never uploads the slot and binds whatever handle it holds.
 */
export const reflectionSlot = installedSlot(SSR_UNIFORM.reflection, THREE.Texture);

/** Shows `reflection` to the lit programs that draw next. */
export function showReflection(renderer: THREE.WebGLRenderer, reflection: THREE.Texture): void {
  showInSlot(renderer, reflectionSlot, reflection);
  screenSpaceState[SCREEN_SPACE_STATE.showsReflection] = 1;
}

/** Shows no reflection to the lit programs that draw next. */
export function hideReflection(): void {
  screenSpaceState[SCREEN_SPACE_STATE.showsReflection] = 0;
}
