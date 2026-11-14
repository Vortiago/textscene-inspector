import { describe, expect, it } from 'vitest';
import { faceStrikesOf, MAX_KEPT_BITMAPS } from './faceStrikes';
import { encodePng } from './png.testkit';
import { bigMetrics, locatorTables, pngImage, strikeFont } from './sbit.testkit';

const { locator, data } = locatorTables([{ ppem: 20, bitDepth: 32, subtables: [] }]);
/** A `glyf` table FreeType finds: the face has outlines unless a rule drops them. */
const GLYF = new Uint8Array(4);

describe('faceStrikesOf', () => {
  it('draws a CBLC face from its strikes alone, as FreeType ignores its outlines', async () => {
    const strikes = await faceStrikesOf(strikeFont({ CBLC: locator, CBDT: data, glyf: GLYF }), false);
    expect(strikes?.isScalable).toBe(false);
  });

  it('draws a glyph an EBLC strike lacks from the outline of its face', async () => {
    const strikes = await faceStrikesOf(strikeFont({ EBLC: locator, EBDT: data, glyf: GLYF }), true);
    expect(strikes?.isScalable).toBe(true);
  });

  it('keeps the bitmaps of the glyphs read most recently, and reads a dropped one again', async () => {
    const pixel = pngImage(encodePng({ width: 1, height: 1, colourType: 6, samples: [255, 0, 0, 255] }));
    const glyphCount = MAX_KEPT_BITMAPS + 1;
    const subtable = {
      first: 1,
      last: glyphCount,
      indexFormat: 2 as const,
      imageFormat: 19,
      images: Array.from({ length: glyphCount }, () => pixel),
      bigMetrics: bigMetrics(1, 1, 0, 1),
    };
    const tables = locatorTables([{ ppem: 20, bitDepth: 32, subtables: [subtable] }]);
    const strikes = (await faceStrikesOf(strikeFont({ CBLC: tables.locator, CBDT: tables.data }), false))!;
    const strike = strikes.sizeAt(20).strike!;
    const first = strikes.bitmapOf(strike, 1);
    expect(strikes.bitmapOf(strike, 1)).toBe(first);
    for (let glyph = 2; glyph <= glyphCount; glyph++) strikes.bitmapOf(strike, glyph);
    expect(strikes.bitmapOf(strike, 1)).not.toBe(first);
    expect(strikes.bitmapOf(strike, 1)).toEqual(first);
  });
});
