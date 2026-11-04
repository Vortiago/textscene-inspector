/**
 * The glyph clip of `TextParagraph::draw`: one shaped line cut to the paragraph box, as
 * `TextServer::shaped_text_draw` cuts it.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { TextLineLayout } from './textLayout';

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
