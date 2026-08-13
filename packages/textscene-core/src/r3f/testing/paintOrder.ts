/**
 * Reading a rendered object's place in the 2D canvas the way three does.
 *
 * Paint order is decided by `reversePainterSortStable`
 * (`three/src/renderers/webgl/WebGLRenderLists.js`): `groupOrder`, then
 * `renderOrder`, then view z DESCENDING, then object id. `groupOrder` is not a
 * property of the drawn object — it is the `renderOrder` of the nearest
 * enclosing `Group`, which `projectObject` overwrites on the way down
 * (`three/src/renderers/WebGLRenderer.js:1838-1840`). A test that reads
 * `mesh.renderOrder` alone is therefore reading the LESS significant half of
 * the key, and will agree with the renderer only by luck.
 *
 * Every 2D canvas material here is `transparent` + `depthWrite={false}`, so
 * this comparator is the whole of what covers what — nothing is resolved by
 * the depth buffer.
 */
import type * as THREE from 'three';

/**
 * The `groupOrder` three would sort this object by: the `renderOrder` of its
 * nearest `Group` ancestor, or 0 if it has none.
 *
 * This is where a canvas item's place in the canvas lives
 * (`canvasPaintOrder.ts`), so it is what a draw-order assertion should read.
 */
export function nearestGroupOrder(object: THREE.Object3D): number {
  for (let ancestor = object.parent; ancestor; ancestor = ancestor.parent) {
    if ((ancestor as THREE.Group).isGroup) return ancestor.renderOrder;
  }
  return 0;
}
