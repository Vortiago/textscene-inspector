import { describe, expect, it } from 'vitest';
import type { SbitStrike } from './sbitStrikes';
import { strikeSizeAt } from './strikeSize';

const strikeOf = (tableIndex: number, ppem: number, width: number): SbitStrike => ({
  tableIndex,
  width,
  metrics: { xPpem: ppem, yPpem: ppem, ascender: 88 * 64, descender: -21 * 64, xScale: 1000, yScale: 1000 },
});

const STRIKES = [strikeOf(0, 20, 24), strikeOf(1, 109, 136)];

describe('strikeSizeAt', () => {
  it('picks the strike whose width is nearest the font size', () => {
    expect(strikeSizeAt(STRIKES, 100, null).strike.tableIndex).toBe(1);
    expect(strikeSizeAt(STRIKES, 70, null).strike.tableIndex).toBe(0);
  });

  it('keeps the first strike of a tie', () => {
    expect(strikeSizeAt(STRIKES, 80, null).strike.tableIndex).toBe(0);
  });

  it('scales the strike by the font size over its width', () => {
    expect(strikeSizeAt(STRIKES, 128, null).scale).toBe(128 / 136);
  });

  it("gives a face of bitmaps alone the strike's own metrics", () => {
    expect(strikeSizeAt(STRIKES, 128, null)).toMatchObject({
      ppem: 109,
      xScale: 1000,
      ascender: 88 * 64,
      descender: -21 * 64,
    });
  });

  it("gives a scalable face its own extent at the strike's ppem, to whole pixels", () => {
    const size = strikeSizeAt(STRIKES, 20, { unitsPerEm: 1000, ascender: 905, descender: -212 });
    const scale = Math.round((20 * 64 * 65536) / 1000);
    expect(size).toMatchObject({
      ppem: 20,
      xScale: scale,
      ascender: Math.ceil(Math.round((905 * scale) / 65536) / 64) * 64,
      descender: Math.floor(-Math.round((212 * scale) / 65536) / 64) * 64,
    });
  });
});
