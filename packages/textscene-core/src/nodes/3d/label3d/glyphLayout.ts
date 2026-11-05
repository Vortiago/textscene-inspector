/**
 * Label3D's line breaking, justification and placement, ported from `scene/3d/label_3d.cpp
 * Label3D::_shape()` (~479-606) over the shared shaping engine.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import {
  shapedTextSizeWidthPx,
  shapeText,
  type TextLayoutResult,
  type TextLineLayout,
} from '../../../r3f/controls/native/text/textLayout';
import type { FontMetrics } from '../../../r3f/controls/native/text/fontMetrics';
import { justifyLinesToWidth } from '../../../r3f/controls/native/text/textJustify';
import type { TextBidiOptions } from '../../../r3f/controls/native/text/textBidiOptions';

import { EMPTY_AABB, type Aabb } from '../../../godot/math/aabb';
import { blockStartY, HorizontalAlignment, lineStartOffset } from '../../../godot/math/alignment';
import type { Label3DProperties } from './types';

type Label3DBreakProperties = Pick<
  Label3DProperties,
  'text' | 'font_size' | 'line_spacing' | 'width' | 'autowrap_mode' | 'autowrap_trim_flags' | 'uppercase'
>;

type Label3DJustifyProperties = Pick<
  Label3DProperties,
  'font_size' | 'width' | 'justification_flags' | 'horizontal_alignment'
>;

type Label3DPlaceProperties = Pick<
  Label3DProperties,
  'horizontal_alignment' | 'vertical_alignment' | 'line_spacing' | 'offset'
>;

interface Label3DLinePlacement {
  /** This line's own left-edge x offset (`label_3d.cpp:588-599`), Godot px. */
  x: number;
  /** This line's "box top" Y, Godot px, y-down. `<TextRun>` anchors the baseline from there (`buildGlyphQuadArrays`). */
  y: number;
  line: TextLineLayout;
}

/**
 * The text shaped in `bidi`, the label's direction, language and override (`label_3d.cpp:479-494`),
 * and broken at `width` as `autowrap_mode` says (`:495-530`). The trim flags apply in every mode, OFF
 * included (`:528`).
 */
export function breakLabel3DLines(
  properties: Label3DBreakProperties,
  bidi: TextBidiOptions,
  fontMetrics?: FontMetrics
): TextLayoutResult {
  return shapeText(properties.text, {
    ...bidi,
    fontSizePx: properties.font_size,
    boxWidthPx: properties.width,
    autowrapMode: properties.autowrap_mode,
    uppercase: properties.uppercase,
    lineSpacingPx: properties.line_spacing,
    autowrapTrimFlags: properties.autowrap_trim_flags,
    fontMetrics,
  });
}

/** Stretches each broken line to `width` under `HORIZONTAL_ALIGNMENT_FILL` (`label_3d.cpp:538-557`), else returns `layout`. */
export function justifyLabel3DLines(
  layout: TextLayoutResult,
  properties: Label3DJustifyProperties
): TextLayoutResult {
  if (properties.horizontal_alignment !== HorizontalAlignment.HORIZONTAL_ALIGNMENT_FILL) return layout;
  return {
    ...layout,
    lines: justifyLinesToWidth(
      layout.lines,
      properties.width,
      properties.justification_flags,
      properties.font_size
    ),
  };
}

/** Per-line placements for an already-shaped `layout`; `offset` moves every line, a positive y up (`:582`, `:600`). */
export function layoutLabel3DLines(
  layout: TextLayoutResult,
  properties: Label3DPlaceProperties
): Label3DLinePlacement[] {
  const blockRisePx = blockStartY(properties.vertical_alignment, layout.heightPx, properties.line_spacing);
  const topPx = -(blockRisePx + properties.offset.y);
  return layout.lines.map((line, lineIndex) => ({
    // Godot aligns by the ceiled `shaped_text_get_width` (`text_server_adv.cpp:7571`).
    x:
      lineStartOffset(shapedTextSizeWidthPx(line.widthPx), properties.horizontal_alignment) +
      properties.offset.x,
    y: topPx + lineIndex * layout.linePitchPx,
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
    right = Math.max(right, placement.x + shapedTextSizeWidthPx(placement.line.widthPx));
  }
  const topDown = placements[0]!.y;
  const bottomDown = placements[placements.length - 1]!.y + linePitchPx;
  return {
    position: { x: left * pixelSize, y: -bottomDown * pixelSize, z: 0 },
    size: { x: (right - left) * pixelSize, y: (bottomDown - topDown) * pixelSize, z: 0 },
  };
}
