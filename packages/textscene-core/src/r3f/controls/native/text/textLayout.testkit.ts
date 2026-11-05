/** Test helpers over a shaped line. */

import type { TextLineLayout } from './textLayout';

/** The line's glyph characters, left to right: the visual order the bidi pass leaves. */
export function visualChars(line: Pick<TextLineLayout, 'glyphs'>): string {
  return line.glyphs.map((glyph) => glyph.char).join('');
}
