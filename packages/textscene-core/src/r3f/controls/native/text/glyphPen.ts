import type { TextLineLayout } from './textLayout';

/**
 * @canonical The origin of each glyph of a line in its canvas item, summed in 32-bit float as Godot's pen
 * Each step takes the gap between two pens, so a glyph a reveal hid still moves the pen.
 */
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
