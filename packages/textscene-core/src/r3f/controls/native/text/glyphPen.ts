import type { TextLineLayout } from './textLayout';

/** @canonical Each glyph's origin in its canvas item, its pen summed in 32-bit float (`label.h:199`). */
export function float32GlyphOriginsPx(line: TextLineLayout, lineOriginXPx: number): number[] {
  const firstX = line.glyphs[0]?.x ?? 0;
  let pen = Math.fround(lineOriginXPx + firstX);
  let previousX = firstX;
  return line.glyphs.map((glyph) => {
    pen = Math.fround(pen + Math.fround(glyph.x - previousX));
    previousX = glyph.x;
    return Math.fround(pen + Math.fround(glyph.xOffset ?? 0));
  });
}
