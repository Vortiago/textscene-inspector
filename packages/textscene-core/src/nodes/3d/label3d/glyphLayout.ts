/**
 * Label3D's line placement, ported from `scene/3d/label_3d.cpp
 * Label3D::_shape()` (~562-623) over an already-shaped `TextLayoutResult`. The
 * unparsed `vertical_alignment`, `autowrap_mode` and `width` render at their
 * `label_3d.h` defaults. `FILL` falls through to CENTER (`label_3d.cpp:592`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { TextLayoutResult, TextLineLayout } from '../../../r3f/controls/native/text/textLayout';

import { EMPTY_AABB, type Aabb } from '../../../godot/math/aabb';
import { lineStartOffset, type HorizontalAlignment } from '../../../godot/math/alignment';
import type { EnumValue } from '../../../godot/classdb/enumNames';

interface Label3DLinePlacement {
  /** This line's own left-edge x offset (`label_3d.cpp:588-599`), Godot px. */
  x: number;
  /** This line's "box top" Y, Godot px, y-down. `<TextRun>` anchors the baseline from there (`buildGlyphQuadArrays`). */
  y: number;
  line: TextLineLayout;
}

/**
 * `label_3d.cpp:568-580`: `vbegin` for `VERTICAL_ALIGNMENT_CENTER`, the only
 * case reachable, with the origin at the text block's vertical centre. Godot's
 * `vbegin = (total_h - line_spacing) / 2` is y-up and `TextRun` is y-down, so
 * the sign flips here rather than in the caller.
 */
function verticalOffsetPx(layout: TextLayoutResult, lineSpacingPx: number): number {
  const contentHeightPx = layout.heightPx - lineSpacingPx;
  return -contentHeightPx / 2;
}

/** Per-line placements for an already-shaped `layout`. */
export function layoutLabel3DLines(
  layout: TextLayoutResult,
  horizontalAlignment: EnumValue<typeof HorizontalAlignment>,
  lineSpacingPx: number
): Label3DLinePlacement[] {
  const vbeginPx = verticalOffsetPx(layout, lineSpacingPx);
  return layout.lines.map((line, lineIndex) => ({
    x: lineStartOffset(line.widthPx, horizontalAlignment),
    y: vbeginPx + lineIndex * layout.linePitchPx,
    line,
  }));
}

/**
 * The box Godot's `_shape` expands over every line (`label_3d.cpp:600-606`), in node space, on the
 * label's z = 0 plane. Each line spans its width and one line pitch down from its top. A label with
 * no lines keeps the empty AABB at the origin.
 */
export function label3DAabb(
  placements: readonly Label3DLinePlacement[],
  linePitchPx: number,
  pixelSize: number
): Aabb {
  if (placements.length === 0) return EMPTY_AABB;
  let left = Infinity;
  let right = -Infinity;
  for (const placement of placements) {
    left = Math.min(left, placement.x);
    right = Math.max(right, placement.x + placement.line.widthPx);
  }
  const topDown = placements[0]!.y;
  const bottomDown = placements[placements.length - 1]!.y + linePitchPx;
  return {
    position: { x: left * pixelSize, y: -bottomDown * pixelSize, z: 0 },
    size: { x: (right - left) * pixelSize, y: (bottomDown - topDown) * pixelSize, z: 0 },
  };
}
