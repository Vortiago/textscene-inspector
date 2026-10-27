import { describe, expect, it } from 'vitest';
import { openFontContainer } from './fontContainer';
import { breakZlibHeaders, woffFromSfnt } from './fontContainer.testkit';
import { fixtureFontBytes } from './sfntOutlines.testkit';
import { parseSfntScalars, readAxisDefaults } from './sfntTables';

async function readFont(bytes: ArrayBuffer) {
  const sfnt = await openFontContainer(bytes);
  return sfnt && { scalars: parseSfntScalars(sfnt), axisDefaults: readAxisDefaults(sfnt) };
}

describe('openFontContainer', () => {
  it('reads the metrics and the fvar defaults of a variable .woff2 from its own tables', async () => {
    const font = await readFont(fixtureFontBytes('recursive-vf-subset.woff2'));

    expect(font).toEqual({
      scalars: { unitsPerEm: 1000, ascent: 950, descent: 250 },
      axisDefaults: { MONO: 0, CASL: 0, wght: 300, slnt: 0, CRSV: 0.5 },
    });
  });

  it('reads a WOFF with zlib tables to the scalars of its plain sfnt', async () => {
    const plain = fixtureFontBytes('montserrat-extra-bold.otf');

    const font = await readFont(woffFromSfnt(plain, { compress: true }));

    expect(font?.scalars).toEqual({ unitsPerEm: 1000, ascent: 968, descent: 251 });
  });

  it('reads a WOFF whose tables are stored raw', async () => {
    const plain = fixtureFontBytes('montserrat-extra-bold.otf');

    const font = await readFont(woffFromSfnt(plain, { compress: false }));

    expect(font?.scalars).toEqual({ unitsPerEm: 1000, ascent: 968, descent: 251 });
  });

  it('reads a plain OpenType font to its scalars and no axes', async () => {
    const font = await readFont(fixtureFontBytes('montserrat-extra-bold.otf'));

    expect(font).toEqual({ scalars: { unitsPerEm: 1000, ascent: 968, descent: 251 }, axisDefaults: {} });
  });

  it('opens the bytes of one font file once, whichever reader asks first', async () => {
    const bytes = fixtureFontBytes('recursive-vf-subset.woff2');

    expect(openFontContainer(bytes)).toBe(openFontContainer(bytes));
  });

  it('answers null, never throws, for a truncated .woff2', async () => {
    const whole = fixtureFontBytes('recursive-vf-subset.woff2');

    for (const length of [3, 47, 60, whole.byteLength >> 1]) {
      expect(await openFontContainer(whole.slice(0, length))).toBeNull();
    }
  });

  it('answers null for a .woff2 whose Brotli stream is corrupt', async () => {
    const corrupt = new Uint8Array(fixtureFontBytes('recursive-vf-subset.woff2').slice(0));
    corrupt.fill(0xff, corrupt.length - 200, corrupt.length - 40);

    expect(await openFontContainer(corrupt.buffer)).toBeNull();
  });

  it('answers null for a truncated WOFF', async () => {
    const whole = woffFromSfnt(fixtureFontBytes('montserrat-extra-bold.otf'), { compress: true });

    for (const length of [3, 43, 100, whole.byteLength >> 1]) {
      expect(await openFontContainer(whole.slice(0, length))).toBeNull();
    }
  });

  it('answers null for a WOFF whose zlib stream is corrupt', async () => {
    const woff = woffFromSfnt(fixtureFontBytes('montserrat-extra-bold.otf'), { compress: true });

    expect(await openFontContainer(breakZlibHeaders(woff))).toBeNull();
  });

  it('answers null for bytes that are no font', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

    expect(await openFontContainer(png.buffer)).toBeNull();
  });
});
