import { describe, expect, it } from 'vitest';
import { openFontOutlines } from './sfntOutlines';
import { ByteWriter, fixtureFontBytes } from './sfntOutlines.testkit';
import { plainGlyfXMins, rebuildHmtx } from './woff2Hmtx';

const hmtxBytes = (writer: ByteWriter): Uint8Array => Uint8Array.from(writer.toBytes());
const X_MINS = Int16Array.of(-5, 7, 11);

describe('rebuildHmtx', () => {
  it('takes every left side bearing from the glyph xMins when the transform leaves them all out', () => {
    const transformed = hmtxBytes(new ByteWriter().u8(3).u16(500).u16(600));

    expect(rebuildHmtx(transformed, 2, X_MINS)).toEqual(
      hmtxBytes(new ByteWriter().u16(500).u16(-5).u16(600).u16(7).u16(11))
    );
  });

  it('reads the monospaced bearings it stores and takes the proportional ones from the xMins', () => {
    const transformed = hmtxBytes(new ByteWriter().u8(1).u16(500).u16(600).u16(-3));

    expect(rebuildHmtx(transformed, 2, X_MINS)).toEqual(
      hmtxBytes(new ByteWriter().u16(500).u16(-5).u16(600).u16(7).u16(-3))
    );
  });

  it.each([
    ['reserved flag bits', 4, 2],
    ['flags that leave out no bearing', 0, 2],
    ['no long metrics', 3, 0],
    ['more long metrics than glyphs', 3, 4],
  ])('rejects %s, as FreeType does', (_, flags, longMetricCount) => {
    const transformed = hmtxBytes(new ByteWriter().u8(flags).u16(500).u16(600).u16(700).u16(800));

    expect(() => rebuildHmtx(transformed, longMetricCount, X_MINS)).toThrow();
  });
});

describe('plainGlyfXMins', () => {
  it('counts the glyphs at maxp offset 8, as FreeType reads it, and reads each xMin at its loca offset', () => {
    const maxp = new ByteWriter().u32(0x10000).u16(9).u16(0).u16(1);
    const head = new ByteWriter().raw(new Array(50).fill(0)).u16(0);
    const loca = new ByteWriter().u16(0).u16(0);
    const glyf = new ByteWriter().u16(1).u16(-12);
    const decoded = new ByteWriter().raw(maxp).raw(head).raw(loca).raw(glyf);

    expect(
      plainGlyfXMins(Uint8Array.from(decoded.toBytes()), { maxp: 0, head: 10, loca: 62, glyf: 66 })
    ).toEqual(Int16Array.of(-12));
  });
});

describe('a WOFF2 font with a transformed hmtx', () => {
  const hYs = async (name: string, sizePx: number) => {
    const outlines = (await openFontOutlines(fixtureFontBytes(name)))!;
    return outlines.glyphContours(outlines.glyphIndex('H'.codePointAt(0)!), sizePx)!.points;
  };

  it('loads the glyphs of the TrueType font it was made from, as Godot 4.6.3 does', async () => {
    expect(await hYs('open-sans-semibold-subset-hmtx.woff2', 17)).toEqual(
      await hYs('open-sans-semibold-subset.ttf', 17)
    );
  });

  it('beside a plain glyf, opens no outlines, as Godot 4.6.3 opens no glyphs', async () => {
    expect(
      await openFontOutlines(fixtureFontBytes('open-sans-semibold-subset-hmtx-plain-glyf.woff2'))
    ).toBeNull();
  });
});
