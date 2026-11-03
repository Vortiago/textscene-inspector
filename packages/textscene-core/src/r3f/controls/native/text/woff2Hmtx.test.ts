import { describe, expect, it } from 'vitest';
import { openFontOutlines } from './sfntOutlines';
import { ByteWriter, fixtureFontBytes, glyphContoursOf } from './sfntOutlines.testkit';
import { HEAD_INDEX_TO_LOC_FORMAT_OFFSET } from './sfntTables';
import { rebuiltHmtxOf, type DecodedTable } from './woff2Hmtx';

const bytesOf = (writer: ByteWriter): Uint8Array => Uint8Array.from(writer.toBytes());
const X_MINS = Int16Array.of(-5, 7, 11);
/** `hhea` up to numberOfHMetrics at 34. */
const HHEA_LONG_METRIC_COUNT_OFFSET = 34;

/** An `hhea` that gives `hmtx` `longMetricCount` long metrics. */
function hheaOf(longMetricCount: number): DecodedTable {
  const hhea = new ByteWriter()
    .raw(new Array<number>(HHEA_LONG_METRIC_COUNT_OFFSET).fill(0))
    .u16(longMetricCount);
  return { bytes: bytesOf(hhea), offset: 0 };
}

/** The `hmtx` rebuilt from `transformed`, with the side bearings it leaves out from `X_MINS`. */
function rebuiltWithXMins(transformed: ByteWriter, longMetricCount: number): Uint8Array {
  const stored = new Map<string, DecodedTable>([
    ['hmtx', { bytes: bytesOf(transformed), offset: 0 }],
    ['hhea', hheaOf(longMetricCount)],
  ]);
  return rebuiltHmtxOf(new Uint8Array(0), stored, X_MINS);
}

describe('rebuiltHmtxOf', () => {
  it('takes every left side bearing from the glyph xMins when the transform leaves them all out', () => {
    const transformed = new ByteWriter().u8(3).u16(500).u16(600);

    expect(rebuiltWithXMins(transformed, 2)).toEqual(
      bytesOf(new ByteWriter().u16(500).u16(-5).u16(600).u16(7).u16(11))
    );
  });

  it('reads the monospaced bearings it stores and takes the proportional ones from the xMins', () => {
    const transformed = new ByteWriter().u8(1).u16(500).u16(600).u16(-3);

    expect(rebuiltWithXMins(transformed, 2)).toEqual(
      bytesOf(new ByteWriter().u16(500).u16(-5).u16(600).u16(7).u16(-3))
    );
  });

  it.each([
    ['reserved flag bits', 4, 2],
    ['flags that leave out no bearing', 0, 2],
    ['no long metrics', 3, 0],
    ['more long metrics than glyphs', 3, 4],
  ])('rejects %s, as FreeType does', (_, flags, longMetricCount) => {
    const transformed = new ByteWriter().u8(flags).u16(500).u16(600).u16(700).u16(800);

    expect(() => rebuiltWithXMins(transformed, longMetricCount)).toThrow();
  });

  it('counts the glyphs of a plain glyf at maxp offset 8, as FreeType reads it, and reads each xMin at its loca offset', () => {
    const maxp = new ByteWriter().u32(0x10000).u16(9).u16(0).u16(1);
    const head = new ByteWriter().raw(new Array<number>(HEAD_INDEX_TO_LOC_FORMAT_OFFSET).fill(0)).u16(0);
    const loca = new ByteWriter().u16(0).u16(0);
    const glyf = new ByteWriter().u16(1).u16(-12);
    const decoded = new ByteWriter().raw(maxp).raw(head).raw(loca).raw(glyf);
    const stored = new Map<string, DecodedTable>([
      ['maxp', { bytes: bytesOf(maxp), offset: 0 }],
      ['head', { bytes: bytesOf(head), offset: 10 }],
      ['loca', { bytes: bytesOf(loca), offset: 62 }],
      ['glyf', { bytes: bytesOf(glyf), offset: 66 }],
      ['hmtx', { bytes: bytesOf(new ByteWriter().u8(3).u16(500)), offset: 70 }],
      ['hhea', hheaOf(1)],
    ]);

    expect(rebuiltHmtxOf(bytesOf(decoded), stored, null)).toEqual(
      bytesOf(new ByteWriter().u16(500).u16(-12))
    );
  });
});

describe('a WOFF2 font with a transformed hmtx', () => {
  const pointsOfH = async (name: string, sizePx: number) =>
    (await glyphContoursOf(fixtureFontBytes(name), 'H', sizePx)).points;

  it('loads the glyphs of the TrueType font it was made from, as Godot 4.6.3 does', async () => {
    expect(await pointsOfH('open-sans-semibold-subset-hmtx.woff2', 17)).toEqual(
      await pointsOfH('open-sans-semibold-subset.ttf', 17)
    );
  });

  it('beside a plain glyf, opens no outlines, as Godot 4.6.3 opens no glyphs', async () => {
    expect(
      await openFontOutlines(fixtureFontBytes('open-sans-semibold-subset-hmtx-plain-glyf.woff2'))
    ).toBeNull();
  });
});
