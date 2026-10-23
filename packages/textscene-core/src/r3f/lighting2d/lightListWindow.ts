/**
 * Where a capped light list's buffer is read: the world rect its items cover. Its passes clip to
 * that window, since a buffer for a few items costs a whole screen of fill otherwise.
 */

import * as THREE from 'three';
import { rect2Merge, type Rect2 } from '../../godot/math/rect2.js';

/**
 * The union of the windows of `placementIds`, or null when one has none: an item the cap never
 * measured may read the buffer anywhere.
 */
export function listWindow(
  placementIds: readonly string[],
  windows: ReadonlyMap<string, Rect2>
): Rect2 | null {
  let union: Rect2 | null = null;
  for (const id of placementIds) {
    const window = windows.get(id);
    if (!window) return null;
    union = union ? rect2Merge(union, window) : window;
  }
  return union;
}

/** One pixel each side, so a fragment on the window's edge still reads its own texel. */
const EDGE_PIXELS = 1;

/** Scratch for `windowScissor`, which runs for every shadowed light's volumes each frame. */
const nearCorner = new THREE.Vector3();
const farCorner = new THREE.Vector3();

/** `window`'s scissor in a `size` buffer that `camera` draws, into `scissor`: x, y, width and height, y up. */
export function windowScissor(
  window: Rect2,
  camera: THREE.Camera,
  size: THREE.Vector2,
  scissor = new THREE.Vector4()
): THREE.Vector4 {
  nearCorner.set(window.x, window.y, 0).project(camera);
  farCorner.set(window.x + window.w, window.y + window.h, 0).project(camera);
  const minX = ((Math.min(nearCorner.x, farCorner.x) + 1) / 2) * size.x;
  const minY = ((Math.min(nearCorner.y, farCorner.y) + 1) / 2) * size.y;
  const maxX = ((Math.max(nearCorner.x, farCorner.x) + 1) / 2) * size.x;
  const maxY = ((Math.max(nearCorner.y, farCorner.y) + 1) / 2) * size.y;
  const left = THREE.MathUtils.clamp(Math.floor(minX) - EDGE_PIXELS, 0, size.x);
  const bottom = THREE.MathUtils.clamp(Math.floor(minY) - EDGE_PIXELS, 0, size.y);
  const right = THREE.MathUtils.clamp(Math.ceil(maxX) + EDGE_PIXELS, 0, size.x);
  const top = THREE.MathUtils.clamp(Math.ceil(maxY) + EDGE_PIXELS, 0, size.y);
  return scissor.set(left, bottom, right - left, top - bottom);
}

/** Narrows `scissor` to its overlap with `bound`, which is empty where they miss. */
export function intersectScissor(scissor: THREE.Vector4, bound: THREE.Vector4): void {
  const left = Math.max(scissor.x, bound.x);
  const bottom = Math.max(scissor.y, bound.y);
  const right = Math.min(scissor.x + scissor.z, bound.x + bound.z);
  const top = Math.min(scissor.y + scissor.w, bound.y + bound.w);
  scissor.set(left, bottom, Math.max(0, right - left), Math.max(0, top - bottom));
}
