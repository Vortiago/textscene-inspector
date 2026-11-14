import { describe, expect, it } from 'vitest';
import { readSbitTables } from './sbitStrikes';
import { locatorTables, sbixTable, strikeFont, type TestLocatorStrike } from './sbit.testkit';

const strikeOf = (strike: Partial<TestLocatorStrike>): TestLocatorStrike => ({
  ppem: 20,
  bitDepth: 32,
  subtables: [],
  ...strike,
});

function colourFont(
  strikes: readonly Partial<TestLocatorStrike>[],
  options: Parameters<typeof strikeFont>[1] = {}
) {
  const { locator, data } = locatorTables(strikes.map(strikeOf));
  return strikeFont({ CBLC: locator, CBDT: data }, options);
}

describe('readSbitTables', () => {
  it('reads a CBLC strike: its ppem, its line metrics in 26.6 and its advance scale', () => {
    const tables = readSbitTables(colourFont([{ ppem: 20, ascender: 16, descender: -4 }]));
    expect(tables?.kind).toBe('CBLC');
    expect(tables?.strikes[0]?.metrics).toEqual({
      xPpem: 20,
      yPpem: 20,
      ascender: 16 * 64,
      descender: -4 * 64,
      xScale: Math.round((20 * 64 * 65536) / 1000),
      yScale: Math.round((20 * 64 * 65536) / 1000),
    });
  });

  it('turns a positive descender down where the strike reaches below the baseline', () => {
    const tables = readSbitTables(colourFont([{ ascender: 16, descender: 4, minAfterBaseline: -3 }]));
    expect(tables?.strikes[0]?.metrics.descender).toBe(-4 * 64);
  });

  it('takes the line extent from the strike bounds where the line metrics are zero', () => {
    const tables = readSbitTables(colourFont([{ maxBeforeBaseline: 15, minAfterBaseline: -5 }]));
    expect(tables?.strikes[0]?.metrics).toMatchObject({ ascender: 15 * 64, descender: -5 * 64 });
  });

  it('takes the ppem as the ascender where the strike gives no extent at all', () => {
    const tables = readSbitTables(colourFont([{ ppem: 20 }]));
    expect(tables?.strikes[0]?.metrics).toMatchObject({ ascender: 20 * 64, descender: 0 });
  });

  it('gives the descender the ppem of height where the ascender and descender meet', () => {
    const tables = readSbitTables(colourFont([{ ppem: 20, ascender: 5, descender: 5, minAfterBaseline: 1 }]));
    expect(tables?.strikes[0]?.metrics).toMatchObject({ ascender: 5 * 64, descender: -15 * 64 });
  });

  it('gives a strike the width of the average advance at its ppem', () => {
    const tables = readSbitTables(colourFont([{ ppem: 109 }], { unitsPerEm: 2048, averageWidth: 2550 }));
    expect(tables?.strikes[0]?.width).toBe(Math.trunc((2550 * 109 + 1024) / 2048));
  });

  it('gives a strike of a font with no OS/2 its ppem as its width', () => {
    expect(readSbitTables(colourFont([{ ppem: 109 }]))?.strikes[0]?.width).toBe(109);
  });

  it('lists only strikes with a ppem', () => {
    const tables = readSbitTables(colourFont([{ ppem: 0 }, { ppem: 32 }]));
    expect(tables?.strikes.map((strike) => [strike.tableIndex, strike.metrics.xPpem])).toEqual([[1, 32]]);
  });

  it('reads EBLC with its EBDT', () => {
    const { locator, data } = locatorTables([strikeOf({ bitDepth: 8 })], 0x00020000);
    expect(readSbitTables(strikeFont({ EBLC: locator, EBDT: data }))?.kind).toBe('EBLC');
  });

  it('has no strikes without a data table', () => {
    const { locator } = locatorTables([strikeOf({})]);
    expect(readSbitTables(strikeFont({ CBLC: locator }))).toBeNull();
  });

  it('has no strikes in a locator of a version FreeType does not know', () => {
    const { locator, data } = locatorTables([strikeOf({})], 0x00040000);
    expect(readSbitTables(strikeFont({ CBLC: locator, CBDT: data }))).toBeNull();
  });

  it('takes CBLC before sbix', () => {
    const { locator, data } = locatorTables([strikeOf({})]);
    const sbix = sbixTable([{ ppem: 40, glyphs: [] }]);
    expect(readSbitTables(strikeFont({ CBLC: locator, CBDT: data, sbix }))?.kind).toBe('CBLC');
  });

  it('reads an sbix strike at the ppem its header gives, with hhea scaled to it', () => {
    const font = strikeFont(
      { sbix: sbixTable([{ ppem: 40, glyphs: [] }]) },
      { ascender: 950, descender: -250 }
    );
    const scale = Math.round((40 * 64 * 65536) / 1000);
    expect(readSbitTables(font)?.strikes[0]?.metrics).toEqual({
      xPpem: 40,
      yPpem: 40,
      ascender: Math.round((950 * scale) / 65536),
      descender: -Math.round((250 * scale) / 65536),
      xScale: scale,
      yScale: scale,
    });
  });

  it('has no strikes in an sbix table whose flags FreeType refuses', () => {
    expect(readSbitTables(strikeFont({ sbix: sbixTable([{ ppem: 40, glyphs: [] }], 2) }))).toBeNull();
  });
});
