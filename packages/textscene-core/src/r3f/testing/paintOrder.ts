/**
 * A rendered object's place in the 2D canvas, read as three reads it:
 * `reversePainterSortStable` (`three/src/renderers/webgl/WebGLRenderLists.js`)
 * sorts by `groupOrder`, then `renderOrder`, then view z descending, then id.
 * Every 2D canvas material skips depth writes, so this comparator decides what covers what.
 */
import type * as THREE from 'three';

/**
 * The `groupOrder` three sorts this object by: the nearest `Group` ancestor's
 * `renderOrder`, or 0 (`three/src/renderers/WebGLRenderer.js:1838-1840`). A canvas
 * item's place lives there (`canvasPaintOrder.ts`), so `mesh.renderOrder` alone is
 * the less significant half.
 */
export function nearestGroupOrder(object: THREE.Object3D): number {
  for (let ancestor = object.parent; ancestor; ancestor = ancestor.parent) {
    if ((ancestor as THREE.Group).isGroup) return ancestor.renderOrder;
  }
  return 0;
}
