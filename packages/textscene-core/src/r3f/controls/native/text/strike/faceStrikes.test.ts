import { describe, expect, it } from 'vitest';
import { faceStrikesOf } from './faceStrikes';
import { locatorTables, strikeFont } from './sbit.testkit';

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
});
