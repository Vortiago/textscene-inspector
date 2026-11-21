/** Times the canvas's own draw of its scene as the Scene draw step. */

import type * as THREE from 'three';
import { observeSceneCamera, observeSceneRenderEnd } from '../sceneRenderCamera.js';
import { beginStep, endStep, innermostStep } from './frameProfile.js';
import type { ViewDrawCounter } from './viewDraw.js';
import { WRAPS_CANVAS_DRAW } from './frameStats.js';

/**
 * Times each render of `scene` through `canvasCamera()` as the Scene draw step, until the returned
 * disposer runs. A capture or a sub-viewport pass draws through a camera of its own, and a render
 * inside another step, such as the 2D light pass, belongs to that step, unless the step wraps the
 * canvas's draw.
 */
export function timeSceneDraws(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  canvasCamera: () => THREE.Camera,
  counter: ViewDrawCounter | null
): () => void {
  /** Whether each render in progress, innermost last, opened the step. */
  const opened: boolean[] = [];
  const stopObserving = observeSceneCamera(scene, (camera) => {
    const outer = innermostStep(renderer);
    const isCanvasDraw = camera === canvasCamera() && (outer === null || WRAPS_CANVAS_DRAW.has(outer));
    opened.push(isCanvasDraw);
    if (!isCanvasDraw) return;
    beginStep(renderer, 'Scene draw');
    counter?.open(renderer);
  });
  const stopFinishing = observeSceneRenderEnd(scene, () => {
    if (!opened.pop()) return;
    counter?.close(renderer, scene);
    endStep(renderer, 'Scene draw');
  });
  return () => {
    stopObserving();
    stopFinishing();
  };
}
