/**
 * The layers of the instance each draw belongs to, for the masks that test them: the reflection
 * probes' and the decals' (`instanceLayersChunk.ts`). three uploads a material's uniforms only when
 * the material or the program changes (r186 `WebGLRenderer.js:2572-2577`), so a draw that changes
 * the layers has it upload them again.
 */

import type * as THREE from 'three';
import { GODOT_DEFAULT_VISUAL_LAYERS } from '../../godot/scene/visualLayers.js';
import { shownDecals } from '../decal/decalSlots.js';
import { shownProbes } from '../reflectionProbe/probeSlots.js';
import { visualLayersOf } from '../visualLayers.js';
import { instanceLayers } from './instanceLayersChunk.js';

/** Written only by `showInstanceLayers`, and cleared by `restoreInstanceLayers` after the draw. */
let shownOn: THREE.WebGLRenderer | null = null;

/** Whether the render in progress shows a probe or a decal, the two readers of the layers. */
function readsLayers(): boolean {
  return shownProbes[0] !== 0 || shownDecals[0] !== 0;
}

/**
 * Shows `object`'s layers to the draw about to run. Most instances keep the default, and a render
 * that shows no probe and no decal reads no layers, so either changes nothing.
 */
export function showInstanceLayers(renderer: THREE.WebGLRenderer, object: THREE.Object3D): void {
  if (!readsLayers()) return;
  const layers = visualLayersOf(object);
  if (layers === GODOT_DEFAULT_VISUAL_LAYERS) return;
  instanceLayers[0] = layers;
  uploadAgain(renderer);
  shownOn = renderer;
}

/** Puts the default back after the draw `showInstanceLayers` changed. */
export function restoreInstanceLayers(): void {
  if (!shownOn) return;
  instanceLayers[0] = GODOT_DEFAULT_VISUAL_LAYERS;
  uploadAgain(shownOn);
  shownOn = null;
}

/**
 * Setting the target it already draws to clears the renderer's current material (r186
 * `WebGLRenderer.js:3099`), so the next draw uploads its material's uniforms.
 */
function uploadAgain(renderer: THREE.WebGLRenderer): void {
  renderer.setRenderTarget(
    renderer.getRenderTarget(),
    renderer.getActiveCubeFace(),
    renderer.getActiveMipmapLevel()
  );
}
