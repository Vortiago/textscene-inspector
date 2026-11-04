/**
 * How `TextParagraph::draw` places one shaped line in the paragraph box: the alignment shift, and
 * the glyph clip `TextServer::shaped_text_draw` cuts it with.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import type { TextLineLayout } from './textLayout';

/**
 * One line's x shift inside its box, as `TextParagraph::draw` applies it while the box has a width
 * (`text_paragraph.cpp:888-921`). CENTER moves a line that fits by half the slack, floored, and a
 * wider one to the trailing edge under RTL. RIGHT, and FILL under RTL, go to the trailing edge,
 * which is negative for a wider line. `lineWidthPx` is `shaped_text_get_width`.
 */
export function textParagraphLineShiftPx(
  lineWidthPx: number,
  boxWidthPx: number,
  alignment: number,
  rtl: boolean
): number {
  if (boxWidthPx <= 0) return 0;
  const trailingPx = boxWidthPx - lineWidthPx;
  switch (alignment) {
    case HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER:
      if (lineWidthPx <= boxWidthPx) return Math.floor(trailingPx / 2);
      return rtl ? trailingPx : 0;
    case HorizontalAlignment.HORIZONTAL_ALIGNMENT_RIGHT:
      return trailingPx;
    case HorizontalAlignment.HORIZONTAL_ALIGNMENT_FILL:
      return rtl ? trailingPx : 0;
    default:
      return 0;
  }
}

/**
 * `TextParagraph::draw` passes `clip_l = max(0, -shiftPx)` and `clip_r = clip_l + boxWidthPx`
 * (`text_paragraph.cpp:925-930`). `shaped_text_draw` skips a glyph that starts left of `clip_l` and
 * stops at the first glyph whose advance ends past `clip_r` (`text_server.cpp:1783-1808`). Both
 * tests run only while the bound is positive, so an unconstrained box draws the whole line.
 * `widthPx` stays the pen extent: alignment and sizing read the shaped width, never the drawn one.
 * Returns `line` itself when nothing is cut.
 *
 * @canonical A shaped line cut to its paragraph box, as TextParagraph draws it
 */
export function clipLineToDrawBox(line: TextLineLayout, boxWidthPx: number, shiftPx: number): TextLineLayout {
  const clipLeftPx = Math.max(0, -shiftPx);
  const clipRightPx = clipLeftPx + boxWidthPx;
  const kept = [];
  for (const glyph of line.glyphs) {
    if (clipRightPx > 0 && glyph.x + glyph.advance > clipRightPx) break;
    if (clipLeftPx > 0 && glyph.x < clipLeftPx) continue;
    kept.push(glyph);
  }
  if (kept.length === line.glyphs.length) return line;
  return { ...line, glyphs: kept, text: kept.map((glyph) => glyph.char).join('') };
}
