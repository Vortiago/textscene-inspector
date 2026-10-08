/**
 * Where a capped light list's buffer is read: the world rect its items cover. Its passes clip to
 * that window, since a buffer for a few items costs a whole screen of fill otherwise.
 */

import * as THREE from 'three';
import { rect2Merge, type Rect2 } from '../../godot/rect2.js';

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

const corner = new THREE.Vector3();

/** `window`'s scissor in a `size` buffer that `camera` draws: x, y, width and height, y up. */
export function windowScissor(window: Rect2, camera: THREE.Camera, size: THREE.Vector2): THREE.Vector4 {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of [
    [window.x, window.y],
    [window.x + window.w, window.y + window.h],
  ] as const) {
    corner.set(x, y, 0).project(camera);
    const pixelX = ((corner.x + 1) / 2) * size.x;
    const pixelY = ((corner.y + 1) / 2) * size.y;
    minX = Math.min(minX, pixelX);
    minY = Math.min(minY, pixelY);
    maxX = Math.max(maxX, pixelX);
    maxY = Math.max(maxY, pixelY);
  }
  const left = THREE.MathUtils.clamp(Math.floor(minX) - EDGE_PIXELS, 0, size.x);
  const bottom = THREE.MathUtils.clamp(Math.floor(minY) - EDGE_PIXELS, 0, size.y);
  const right = THREE.MathUtils.clamp(Math.ceil(maxX) + EDGE_PIXELS, 0, size.x);
  const top = THREE.MathUtils.clamp(Math.ceil(maxY) + EDGE_PIXELS, 0, size.y);
  return new THREE.Vector4(left, bottom, right - left, top - bottom);
}
