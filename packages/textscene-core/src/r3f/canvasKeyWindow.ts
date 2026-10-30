/**
 * Draws the canvas items of one scene whose paint-order key (`canvasPaintOrder.ts`) lies in a window.
 * A sub-viewport under BG_CANVAS draws its canvas in two parts, the layers behind its 3D render and
 * the layers over it, from one scene.
 */

import * as THREE from 'three';

/** The channel every drawn object sits on, and the one a camera sees by default. */
const DRAWN_CHANNEL = 0;

/** Marks an object whose subtree draws over every canvas layer, as the copy of the world does. */
export const OVER_EVERY_LAYER = 'overEveryLayer';

/**
 * Runs `draw` with the objects of `scene` whose key `inWindow` rejects off the default layer, and
 * puts them back after it. The key of an object is `groupOrder` as three takes it: the `renderOrder`
 * of the nearest Group above it. A layer, not `visible`, so a rejected object keeps its children.
 */
export function drawCanvasKeys<T>(
  scene: THREE.Object3D,
  inWindow: (key: number) => boolean,
  draw: () => T
): T {
  const rejected: THREE.Object3D[] = [];
  const visit = (object: THREE.Object3D, inherited: number): void => {
    const key =
      inherited === Number.POSITIVE_INFINITY || object.userData[OVER_EVERY_LAYER]
        ? Number.POSITIVE_INFINITY
        : object instanceof THREE.Group
          ? object.renderOrder
          : inherited;
    if (!inWindow(key) && object.layers.isEnabled(DRAWN_CHANNEL)) {
      object.layers.disable(DRAWN_CHANNEL);
      rejected.push(object);
    }
    for (const child of object.children) visit(child, key);
  };
  visit(scene, 0);
  try {
    return draw();
  } finally {
    for (const object of rejected) object.layers.enable(DRAWN_CHANNEL);
  }
}
