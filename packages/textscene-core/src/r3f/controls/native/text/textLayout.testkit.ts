/** Test helpers over a shaped line. */

import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import type { FontMetrics } from './fontMetrics';
import { shapeText, type GlyphPlacement, type TextLineLayout } from './textLayout';

/** The line's glyph characters, left to right: the visual order the bidi pass leaves. */
export function visualChars(line: Pick<TextLineLayout, 'glyphs'>): string {
  return line.glyphs.map((glyph) => glyph.char).join('');
}

/** The glyphs of `text` shaped on one unwrapped line, without the zero-width terminator. */
export function glyphsOf(text: string, fontMetrics: FontMetrics, fontSizePx = 16): GlyphPlacement[] {
  return shapeText(text, {
    fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 0,
    fontMetrics,
  }).lines[0]!.glyphs.filter((glyph) => glyph.char !== '\u200b');
}
