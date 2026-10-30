/**
 * Draws the canvas items of one scene whose paint-order key (`canvasPaintOrder.ts`) lies in a window.
 * A sub-viewport under BG_CANVAS draws its canvas in two parts, the layers behind its 3D render and
 * the layers over it, from one scene.
 */

import * as THREE from 'three';

const DEFAULT_CAMERA_LAYER = 0;

/** Marks an object whose subtree draws over every canvas layer, as the copy of the world does. */
export const OVER_EVERY_LAYER = 'overEveryLayer';

/**
 * The key of `object` as three takes it: the `renderOrder` of the nearest Group above it. A subtree
 * marked {@link OVER_EVERY_LAYER} keeps an infinite key all the way down.
 */
function keyOf(object: THREE.Object3D, inherited: number): number {
  if (inherited === Number.POSITIVE_INFINITY || object.userData[OVER_EVERY_LAYER]) {
    return Number.POSITIVE_INFINITY;
  }
  return object instanceof THREE.Group ? object.renderOrder : inherited;
}

/**
 * Runs `draw` with the objects of `scene` whose key `inWindow` rejects off the default camera layer,
 * and puts them back after it. A layer, not `visible`, so a rejected object keeps its children.
 */
export function drawCanvasKeys<T>(
  scene: THREE.Object3D,
  inWindow: (key: number) => boolean,
  draw: () => T
): T {
  const rejected: THREE.Object3D[] = [];
  const visit = (object: THREE.Object3D, inherited: number): void => {
    const key = keyOf(object, inherited);
    if (!inWindow(key) && object.layers.isEnabled(DEFAULT_CAMERA_LAYER)) {
      object.layers.disable(DEFAULT_CAMERA_LAYER);
      rejected.push(object);
    }
    for (const child of object.children) visit(child, key);
  };
  visit(scene, 0);
  try {
    return draw();
  } finally {
    for (const object of rejected) object.layers.enable(DEFAULT_CAMERA_LAYER);
  }
}
