/**
 * A rendered object's place in the 2D canvas, read as three reads it:
 * `reversePainterSortStable` (`three/src/renderers/webgl/WebGLRenderLists.js`)
 * sorts by `groupOrder`, then `renderOrder`, then view z descending, then id.
 * Every 2D canvas material skips depth writes, so this comparator decides what covers what.
 */
import type * as THREE from 'three';
import { WHOLE_CANVAS_RANGE } from '../canvasPaintOrder';

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

/** The whole canvas range holds one bucket's sequences, so its size is the bucket stride of a key. */
const SEQUENCE_STRIDE = WHOLE_CANVAS_RANGE.size;

/** The `(layer, z_final)` bucket of a packed canvas key: two keys in one bucket differ only in sequence. */
export function paintBucket(order: number): number {
  return Math.floor(order / SEQUENCE_STRIDE);
}

/** The sequence of a packed canvas key, inside its bucket. */
export function paintSequence(order: number): number {
  return order % SEQUENCE_STRIDE;
}
