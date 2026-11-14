import { describe, expect, it } from 'vitest';
import { encodePng, inflate } from './png.testkit';
import { readSbitTables } from './sbitStrikes';
import { readSbixGlyph, type ContourBox } from './sbixGlyph';
import { sbixTable, strikeFont, type TestSbixGlyph } from './sbit.testkit';

/** A 2 × 1 PNG of an opaque red pixel and an opaque blue one. */
const RED_BLUE = [...encodePng({ width: 2, height: 1, colourType: 2, samples: [255, 0, 0, 0, 0, 255] })];
const RED = [0, 0, 255, 255];
const BLUE = [255, 0, 0, 255];

const png = (originX = 0, originY = 0): TestSbixGlyph => ({ type: 'png ', data: RED_BLUE, originX, originY });
const reference = (type: 'dupe' | 'flip', glyph: number): TestSbixGlyph => ({ type, data: [0, glyph] });

/** The bitmap of glyph `glyph` in one 40 ppem strike of `glyphs`. */
function glyphOf(
  glyph: number,
  glyphs: readonly (TestSbixGlyph | null)[],
  contourBoxOf = (_: number): ContourBox | null => null
) {
  const tables = readSbitTables(
    strikeFont({ sbix: sbixTable([{ ppem: 40, glyphs }]) }, { glyphCount: glyphs.length })
  )!;
  return readSbixGlyph(tables, tables.strikes[0]!, glyph, {
    glyphCount: glyphs.length,
    inflate,
    contourBoxOf,
  });
}

describe('readSbixGlyph', () => {
  it('reads a PNG, its bitmap rising from the origin the record gives', () => {
    const bitmap = glyphOf(1, [null, png(-2, -3)]);
    expect(bitmap).toMatchObject({ pixelMode: 'bgra', width: 2, rows: 1, pitch: 8, left: -2, top: -3 + 1 });
    expect([...bitmap!.buffer]).toEqual([...RED, ...BLUE]);
  });

  it("draws a dupe as the other glyph's image", () => {
    expect([...glyphOf(2, [null, png(), reference('dupe', 1)])!.buffer]).toEqual([...RED, ...BLUE]);
  });

  it("draws a flip as the other glyph's image mirrored", () => {
    expect([...glyphOf(2, [null, png(), reference('flip', 1)])!.buffer]).toEqual([...BLUE, ...RED]);
  });

  it('follows at most four references', () => {
    const chain = [
      null,
      png(),
      reference('dupe', 1),
      reference('dupe', 2),
      reference('dupe', 3),
      reference('dupe', 4),
    ];
    expect(glyphOf(5, chain)).not.toBeNull();
    expect(glyphOf(6, [...chain, reference('dupe', 5)])).toBeNull();
  });

  it('fails a JPEG', () => {
    expect(glyphOf(1, [null, { type: 'jpg ', data: [0xff, 0xd8] }])).toBeNull();
  });

  it('has no bitmap for a glyph with no record', () => {
    expect(glyphOf(0, [null, png()])).toBeNull();
  });

  it("moves the bitmap of a glyph with a contour to its box's corner at the strike's scale", () => {
    // 40 ppem at 1000 units: a bearing of 50 is 2 px, a yMin of -75 is -3 px.
    const bitmap = glyphOf(1, [null, png()], (glyph) =>
      glyph === 1 ? { leftBearing: 50, yMin: -75 } : null
    );
    expect(bitmap).toMatchObject({ left: 2, top: 1 - 3 });
  });
});
