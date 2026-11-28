/** Times the canvas's own draw of its scene as the Scene draw step. */

import type * as THREE from 'three';
import { innermostStep, withFrameStep } from './frameProfile.js';
import { countViewDraw } from './viewDraw.js';
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
  countsSurfaces: boolean
): () => void {
  const render = renderer.render;
  renderer.render = function (drawn, camera) {
    if (drawn !== scene || camera !== canvasCamera()) return render.call(this, drawn, camera);
    const outer = innermostStep(renderer);
    if (outer !== null && !WRAPS_CANVAS_DRAW.has(outer)) return render.call(this, drawn, camera);
    const draw = () => render.call(this, drawn, camera);
    withFrameStep(renderer, 'Scene draw', () => {
      if (countsSurfaces) countViewDraw(renderer, scene, draw);
      else draw();
    });
  };
  return () => {
    renderer.render = render;
  };
}
