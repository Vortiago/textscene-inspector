/**
 * The reflection every lit program reads of the screen-space reflection (`ssrSceneChunk.ts`): the
 * reflection of the render that draws.
 */

import * as THREE from 'three';
import { installedSlot } from '../sharedTexture.js';

export const SSR_UNIFORM = { reflection: 'godotSsrReflection' } as const;

/**
 * The full-size reflection a lit material reads at its own pixel: premultiplied, with the tone map
 * of the trace undone. three never uploads the slot and binds whatever handle it holds.
 */
export const reflectionSlot = installedSlot(SSR_UNIFORM.reflection, THREE.Texture);
