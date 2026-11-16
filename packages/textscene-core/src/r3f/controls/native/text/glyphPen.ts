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

// The x step, not the advance: a run cut from a line of several faces skips the advances of the others.
function itemSummedOriginsPx(line: TextLineLayout, lineOriginXPx: number): number[] {
  const firstX = line.glyphs[0]?.x ?? 0;
  let pen = Math.fround(lineOriginXPx + firstX);
  let previousX = firstX;
  return line.glyphs.map((glyph) => {
    pen = Math.fround(pen + Math.fround(glyph.x - previousX));
    previousX = glyph.x;
    return withOwnOffset(pen, glyph);
  });
}

function lineSummedOriginsPx(line: TextLineLayout, lineOriginXPx: number): number[] {
  const firstX = line.glyphs[0]?.x ?? 0;
  const keepsLinePens = line.glyphs.every((glyph) => glyph.linePenPx !== undefined);
  const origin = Math.fround(keepsLinePens ? lineOriginXPx : lineOriginXPx + firstX);
  let sum = 0;
  let previousX = firstX;
  return line.glyphs.map((glyph) => {
    sum = glyph.linePenPx ?? Math.fround(sum + Math.fround(glyph.x - previousX));
    previousX = glyph.x;
    return withOwnOffset(Math.fround(origin + sum), glyph);
  });
}

const withOwnOffset = (pen: number, glyph: GlyphPlacement) =>
  Math.fround(pen + Math.fround(glyph.xOffset ?? 0));
