/**
 * Label3D's line placement and outline stroke, ported from `scene/3d/label_3d.cpp
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
import { HorizontalAlignment } from './types';

export interface Label3DLinePlacement {
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

/**
 * `label_3d.cpp:588-599`. `FILL` shares `CENTER`'s branch: justification lives
 * in the `width`-driven `shaped_text_fit_to_width` block, and `width` is unparsed.
 */
function horizontalOffsetPx(lineWidthPx: number, alignment: HorizontalAlignment): number {
  switch (alignment) {
    case HorizontalAlignment.CENTER:
    case HorizontalAlignment.FILL:
      return -lineWidthPx / 2;
    case HorizontalAlignment.RIGHT:
      return -lineWidthPx;
    case HorizontalAlignment.LEFT:
    default:
      return 0;
  }
}

/** Per-line placements for an already-shaped `layout`. */
export function layoutLabel3DLines(
  layout: TextLayoutResult,
  horizontalAlignment: HorizontalAlignment,
  lineSpacingPx: number
): Label3DLinePlacement[] {
  const vbeginPx = verticalOffsetPx(layout, lineSpacingPx);
  return layout.lines.map((line, lineIndex) => ({
    x: horizontalOffsetPx(line.widthPx, horizontalAlignment),
    y: vbeginPx + lineIndex * layout.linePitchPx,
    line,
  }));
}

/**
 * The one-sided reach of Godot's outline stroke, `outline_size * 16 / 64` px. FreeType's
 * stroker (`text_server_adv.cpp:1376-1403`, keyed at `label_3d.cpp:344-349`) gets
 * `outline_size` unscaled (`text_server_adv.h:406-414`), and `FT_Stroker_Set`
 * (`text_server_adv.cpp:1383`) takes 26.6 fixed point, so `font_size` plays no part.
 */
export function outlineRadiusPx(outlineSizePx: number): number {
  return Math.trunc(outlineSizePx * 16) / 64;
}

/**
 * The canvas stroke width for that radius: a canvas stroke is centred on the
 * path, like `FT_Glyph_Stroke`'s both-borders annulus (`text_server_adv.cpp:
 * 1392`). `0` when Godot skips the outline pass (`label_3d.cpp:610`:
 * `outline_modulate.a != 0.0 && outline_size > 0`).
 */
export function outlineStrokeWidthPx(outlineSizePx: number): number {
  if (outlineSizePx <= 0) return 0;
  return 2 * outlineRadiusPx(outlineSizePx);
}
