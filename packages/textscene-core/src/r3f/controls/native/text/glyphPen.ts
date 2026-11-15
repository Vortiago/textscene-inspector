import type { GlyphPlacement, TextLineLayout } from './textLayout';

/** Where a Godot holder starts the 32-bit pen sum of a line. */
export type PenSum =
  /** At the run's place in its canvas item: `Label` (`label.h:199`) and `LineEdit` (`line_edit.cpp:1487`). */
  | 'fromItemPosition'
  /** At zero, with the line origin added to each pen: `shaped_text_draw` (`text_server.cpp:1755`). */
  | 'alongLine';

/** @canonical Each glyph's origin in its canvas item, its pen summed in 32-bit float as `penSum` says. */
export function glyphOriginsPx(line: TextLineLayout, lineOriginXPx: number, penSum: PenSum): number[] {
  return penSum === 'fromItemPosition'
    ? itemSummedOriginsPx(line, lineOriginXPx)
    : lineSummedOriginsPx(line, lineOriginXPx);
}

function itemSummedOriginsPx(line: TextLineLayout, lineOriginXPx: number): number[] {
  let pen = Math.fround(lineOriginXPx + (line.glyphs[0]?.x ?? 0));
  return line.glyphs.map((glyph) => {
    const origin = withOwnOffset(pen, glyph);
    pen = Math.fround(pen + Math.fround(glyph.advance));
    return origin;
  });
}

function lineSummedOriginsPx(line: TextLineLayout, lineOriginXPx: number): number[] {
  const keepsLinePens = line.glyphs.every((glyph) => glyph.linePenPx !== undefined);
  const origin = Math.fround(keepsLinePens ? lineOriginXPx : lineOriginXPx + (line.glyphs[0]?.x ?? 0));
  let sum = 0;
  return line.glyphs.map((glyph) => {
    sum = glyph.linePenPx ?? sum;
    const glyphOrigin = withOwnOffset(Math.fround(origin + sum), glyph);
    sum = Math.fround(sum + Math.fround(glyph.advance));
    return glyphOrigin;
  });
}

const withOwnOffset = (pen: number, glyph: GlyphPlacement) =>
  Math.fround(pen + Math.fround(glyph.xOffset ?? 0));
