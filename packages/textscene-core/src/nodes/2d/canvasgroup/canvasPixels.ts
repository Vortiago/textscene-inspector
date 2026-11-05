/**
 * Godot's global canvas pixels, y down from the clip's top-left corner, against the y-up world a
 * canvas draws in. A CanvasGroup fits its rect in these pixels (`renderer_canvas_cull.cpp:208-236`).
 */

import * as THREE from 'three';
import type { Rect2 } from '../../../godot/math/rect2';
import type { CanvasClip } from '../../../r3f/lighting2d/lightPassHost';

/** The canvas pixel rect that `box`, a world box, covers. */
export function canvasPixelRect(box: THREE.Box3, { rect, scale }: CanvasClip): Rect2 {
  return {
    x: (box.min.x - rect.x) * scale.x,
    y: (rect.y + rect.h - box.max.y) * scale.y,
    w: (box.max.x - box.min.x) * scale.x,
    h: (box.max.y - box.min.y) * scale.y,
  };
}

/** The world box that `pixels`, a canvas pixel rect, covers. */
export function worldBoxOfCanvasPixels(pixels: Rect2, { rect, scale }: CanvasClip): THREE.Box3 {
  const minX = rect.x + pixels.x / scale.x;
  const maxY = rect.y + rect.h - pixels.y / scale.y;
  return new THREE.Box3(
    new THREE.Vector3(minX, maxY - pixels.h / scale.y, 0),
    new THREE.Vector3(minX + pixels.w / scale.x, maxY, 0)
  );
}

/** The clip in canvas pixels, `Rect2(0, 0, size)` (`renderer_viewport.cpp:390`). */
export function clipPixelRect({ rect, scale }: CanvasClip): Rect2 {
  return { x: 0, y: 0, w: rect.w * scale.x, h: rect.h * scale.y };
}
