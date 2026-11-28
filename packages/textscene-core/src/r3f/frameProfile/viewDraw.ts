import type * as THREE from 'three';
import { closeViewDraw, openViewDraw } from './frameProfile.js';
import { countDrawnSurfaces, type DrawnSurfaces } from './drawnSurfaces.js';

/** Written only by `endViewDraw`, which clears it before each count: view draws never interleave. */
const drawn: DrawnSurfaces = { objects: 0, primitives: 0 };

/** Closes the view's draw of `scene`. It is never nested in another render, so its list is at depth 0. */
function endViewDraw(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
  drawn.objects = 0;
  drawn.primitives = 0;
  countDrawnSurfaces(renderer.renderLists.get(scene, 0), drawn);
  closeViewDraw(renderer, drawn.objects, drawn.primitives);
}

/** Runs `draw`, the view's draw of `scene` that Godot's monitor counts, such as the root viewport's. */
export function countViewDraw(renderer: THREE.WebGLRenderer, scene: THREE.Scene, draw: () => void): void {
  openViewDraw(renderer);
  try {
    draw();
    endViewDraw(renderer, scene);
  } catch (error) {
    closeViewDraw(renderer, 0, 0);
    throw error;
  }
}
