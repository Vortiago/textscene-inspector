/**
 * `ReferenceRect::_notification(NOTIFICATION_DRAW)`'s
 * `draw_rect(Rect2(Point2(), get_size()), border_color, false, border_width)`
 * (`reference_rect.cpp:36-42`), resolved through `CanvasItem::draw_rect`'s
 * UNFILLED path (`scene/main/canvas_item.cpp:815-841`) — the only path this
 * call ever takes (`p_filled` is a hard `false`).
 *
 * Godot strokes an unfilled rect as a closed 4-point polyline
 * (`canvas_item_add_polyline`), width `border_width`, centred on the rect's
 * own edge (half in, half out) — `canvas_item.cpp:830-840`. Every segment of
 * a rect's polyline is axis-aligned and every corner is exactly 90°, so a
 * mitered join and a plain per-edge rectangle coincide there: this returns 4
 * non-overlapping quads (top/bottom carry the corners, left/right are
 * trimmed between them) rather than reproducing polyline/miter geometry that
 * would draw the same pixels. `draw_rect` requests no antialiasing
 * (`p_antialiased` left at its `false` default), so there is no edge
 * softening to reproduce either.
 */

import type { Rect2 } from '../../../../r3f/controls/native/rect';

/** `canvas_item.cpp:827-828`: `p_width >= rect.size.width || p_width >= rect.size.height` grows a FILLED rect by `0.5 * p_width` instead of stroking. `Rect2::grow` shrinks the position and grows the size symmetrically on every side. */
function grownFilledRect(w: number, h: number, width: number): readonly Rect2[] {
  const g = 0.5 * width;
  return [{ x: -g, y: -g, w: w + 2 * g, h: h + 2 * g }];
}

/**
 * The border quads for a `w`×`h` rect stroked at `width`, in the rect's OWN
 * local space (top-left at `(0, 0)`). Empty for a non-positive width — Godot
 * still calls `canvas_item_add_polyline`/`add_rect` with such a width, but
 * both draw nothing for a non-positive size, and `set_border_width` already
 * floors the authored property at `0` (`referencerect/parser.ts`).
 */
export function referenceRectBorderQuads(w: number, h: number, width: number): readonly Rect2[] {
  if (width <= 0) return [];
  if (width >= w || width >= h) return grownFilledRect(w, h, width);

  const half = width / 2;
  return [
    // Top and bottom carry the corners — full width, straddling each edge.
    { x: -half, y: -half, w: w + width, h: width },
    { x: -half, y: h - half, w: w + width, h: width },
    // Left and right are trimmed to the span BETWEEN top/bottom, so no pixel
    // is covered twice (material alpha < 1 would double-blend otherwise).
    { x: -half, y: half, w: width, h: h - width },
    { x: w - half, y: half, w: width, h: h - width },
  ];
}
