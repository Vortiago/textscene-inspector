/**
 * The border of `draw_rect(Rect2(Point2(), get_size()), border_color, false, border_width)`
 * (`reference_rect.cpp:36-42`) through the unfilled path of `CanvasItem::draw_rect`
 * (`scene/main/canvas_item.cpp:815-841`), without antialiasing.
 */

import type { Rect2 } from '../../../../r3f/controls/native/rect';

/** `canvas_item.cpp:827-828`: `p_width >= rect.size.width || p_width >= rect.size.height` draws a filled rect grown by `0.5 * p_width` on every side instead. */
function grownFilledRect(w: number, h: number, width: number): readonly Rect2[] {
  const g = 0.5 * width;
  return [{ x: -g, y: -g, w: w + 2 * g, h: h + 2 * g }];
}

/**
 * The border quads for a `w`×`h` rect stroked at `width`, in the rect's local
 * space. Empty for a non-positive width, which draws nothing in Godot.
 */
export function referenceRectBorderQuads(w: number, h: number, width: number): readonly Rect2[] {
  if (width <= 0) return [];
  if (width >= w || width >= h) return grownFilledRect(w, h, width);

  // Godot strokes a closed polyline centred on the edge (`canvas_item.cpp:830-840`).
  // At 90° corners a miter equals per-edge rectangles, so four quads draw the
  // same pixels.
  const half = width / 2;
  return [
    // Top and bottom carry the corners: full width, straddling each edge.
    { x: -half, y: -half, w: w + width, h: width },
    { x: -half, y: h - half, w: w + width, h: width },
    // Left and right span only between top and bottom, so an alpha below 1
    // never blends twice.
    { x: -half, y: half, w: width, h: h - width },
    { x: w - half, y: half, w: width, h: h - width },
  ];
}
