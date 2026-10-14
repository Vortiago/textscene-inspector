/**
 * The layers of the instance each draw belongs to, for the probes' mask (`probeShaderChunk.ts`). three
 * uploads a material's uniforms only when the material or the program changes (r186
 * `WebGLRenderer.js:2572-2577`), so a draw that changes the layers has it upload them again.
 */

import type * as THREE from 'three';
import { GODOT_DEFAULT_VISUAL_LAYERS } from '../../godot/visualLayers.js';
import { visualLayersOf } from '../visualLayers.js';
import { instanceLayers } from './probeSlots.js';

/** Written only by `showInstanceLayers`, and cleared by `restoreInstanceLayers` after the draw. */
let shownOn: THREE.WebGLRenderer | null = null;

/** Shows `object`'s layers to the draw about to run. Most instances keep the default, which changes nothing. */
export function showInstanceLayers(renderer: THREE.WebGLRenderer, object: THREE.Object3D): void {
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
