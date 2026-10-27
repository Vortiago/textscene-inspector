import { describe, expect, it } from 'vitest';
import { ContourPointTag } from '../../../../godot/text/textServerEnums';
import type { GlyphContours } from './glyphContours';
import { openFontOutlines, type SfntOutlines } from './sfntOutlines';
import {
  buildTestFont,
  cmapTable,
  fixtureFontBytes,
  headTable,
  maxpTable,
  sfntFileBytes,
  type TestGlyph,
  type TestPoint,
} from './sfntOutlines.testkit';

/** Open Sans SemiBold, 2048 units per em, subset to ASCII letters, digits and `é`. */
async function openSans() {
  const outlines = await openFontOutlines(fixtureFontBytes('open-sans-semibold-subset.ttf'));
  if (!outlines) throw new Error('the Open Sans fixture does not parse');
  return outlines;
}

function contoursOf(outlines: SfntOutlines, char: string, fontSizePx: number): GlyphContours {
  const contours = outlines.glyphContours(outlines.glyphIndex(char.codePointAt(0)!), fontSizePx);
  if (!contours) throw new Error(`no outline for ${char}`);
  return contours;
}

const xs = (contours: GlyphContours) => contours.points.map((p) => p.x);
const ys = (contours: GlyphContours) => contours.points.map((p) => p.y);
const tags = (contours: GlyphContours) => contours.points.map((p) => p.tag);

function square(x: number, y: number, size: number): TestPoint[] {
  return [
    { x, y, on: true },
    { x, y: y + size, on: true },
    { x: x + size, y: y + size, on: true },
    { x: x + size, y, on: true },
  ];
}

const NOTDEF: TestGlyph = { kind: 'empty' };

describe('openFontOutlines glyph index', () => {
  it('maps a character through cmap format 4', async () => {
    const outlines = await openSans();
    // `font_get_glyph_index` of the same font in Godot 4.6.3 answered 20 for H and 66 for é.
    expect(outlines.glyphIndex(0x48)).toBe(20);
    expect(outlines.glyphIndex(0xe9)).toBe(66);
  });

  it('answers 0 for a character the font lacks', async () => {
    expect((await openSans()).glyphIndex(0x0416)).toBe(0);
  });

  it('maps a code point beyond the Basic Multilingual Plane through cmap format 12', async () => {
    const bytes = buildTestFont({
      unitsPerEm: 100,
      glyphs: [NOTDEF, { kind: 'simple', contours: [square(0, 0, 10)] }],
      cmap: new Map([[0x1f600, 1]]),
      cmapFormat: 12,
    });
    const outlines = (await openFontOutlines(bytes))!;
    expect([outlines.glyphIndex(0x1f600), outlines.glyphIndex(0x41)]).toEqual([1, 0]);
  });
});

describe('openFontOutlines containers', () => {
  const glyphs: TestGlyph[] = [NOTDEF, { kind: 'simple', contours: [square(0, 0, 50)] }];
  const cmap = new Map([[0x41, 1]]);

  it('reads a font tagged `true`', async () => {
    const outlines = await openFontOutlines(
      buildTestFont({ unitsPerEm: 100, glyphs, cmap, cmapFormat: 4, container: 'true' })
    );
    expect(outlines?.glyphIndex(0x41)).toBe(1);
  });

  it('reads the first face of a collection', async () => {
    const outlines = await openFontOutlines(
      buildTestFont({ unitsPerEm: 100, glyphs, cmap, cmapFormat: 4, container: 'ttc' })
    );
    expect(outlines?.glyphIndex(0x41)).toBe(1);
  });

  it('gives no reader for a font with neither glyf nor CFF outlines', async () => {
    const noOutlines = sfntFileBytes([
      ['cmap', cmapTable({ cmap: new Map([[0x41, 1]]), cmapFormat: 4 })],
      ['head', headTable(1000)],
      ['maxp', maxpTable(2)],
    ]);
    expect(await openFontOutlines(noOutlines)).toBeNull();
  });

  it('gives no reader for bytes that stop inside the table directory', async () => {
    expect(
      await openFontOutlines(fixtureFontBytes('open-sans-semibold-subset.ttf').slice(0, 100))
    ).toBeNull();
  });
});

describe('openFontOutlines simple glyph', () => {
  it('reads the points of H at 64 px with the x Godot measured and the y negated', async () => {
    const contours = contoursOf(await openSans(), 'H', 64);
    // x: `font_get_glyph_contours` of this font at size 64 in Godot 4.6.3. y: the design units
    // 0, 660, 1462 and 864 over 32, without the vertical hinting Godot adds.
    expect(xs(contours)).toEqual([
      42.03125, 34.5625, 34.5625, 13.5, 13.5, 6, 6, 13.5, 13.5, 34.5625, 34.5625, 42.03125,
    ]);
    expect(ys(contours)).toEqual([
      -0, -0, -20.625, -20.625, -0, -0, -45.6875, -45.6875, -27, -27, -45.6875, -45.6875,
    ]);
  });

  it('ends the one contour of H on its last point, every point on the curve', async () => {
    const contours = contoursOf(await openSans(), 'H', 64);
    expect(contours.contourEnds).toEqual([11]);
    expect(tags(contours)).toEqual(new Array(12).fill(ContourPointTag.ON));
  });

  it('rounds each coordinate to a 26.6 fixed-point step as FreeType does', async () => {
    // 1345 design units at 16 px is 10.5078125, and FreeType's `FT_MulFix` rounds up to 673/64.
    expect(xs(contoursOf(await openSans(), 'H', 16))[0]).toBe(10.515625);
  });

  it('keeps the conic control points of o in Godot order, with the two contour ends', async () => {
    const contours = contoursOf(await openSans(), 'o', 64);
    expect(contours.contourEnds).toEqual([13, 25]);
    expect(tags(contours)).toEqual([
      1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    ]);
  });

  it('reads three contours for g', async () => {
    const contours = contoursOf(await openSans(), 'g', 64);
    expect([contours.points.length, contours.contourEnds]).toEqual([66, [42, 52, 65]]);
  });

  it('answers a fill-right orientation for a TrueType outline', async () => {
    expect(contoursOf(await openSans(), 'o', 64).isFillRight).toBe(true);
  });

  it('answers a fill-left orientation for outer contours wound counter-clockwise', async () => {
    const counterClockwise = square(0, 0, 50).reverse();
    const outlines = (await openFontOutlines(
      buildTestFont({
        unitsPerEm: 100,
        glyphs: [NOTDEF, { kind: 'simple', contours: [counterClockwise] }],
        cmap: new Map([[0x41, 1]]),
        cmapFormat: 4,
      })
    ))!;
    expect(outlines.glyphContours(1, 100)?.isFillRight).toBe(false);
  });
});

describe('openFontOutlines composite glyph', () => {
  it('resolves é to the points of its components with Godot x and tags', async () => {
    const contours = contoursOf(await openSans(), 'é', 16);
    // `font_get_glyph_contours` of this font at size 16 in Godot 4.6.3.
    expect(contours.contourEnds).toEqual([21, 28, 40]);
    expect(xs(contours)).toEqual([
      4.765625, 6.484375, 8.46875, 8.46875, 8.46875, 2.6875, 2.71875, 4.015625, 5.171875, 6.0, 7.328125,
      8.03125, 8.03125, 7.375, 6.03125, 5.09375, 3.828125, 1.890625, 0.8125, 0.8125, 0.8125, 2.96875,
      4.765625, 3.890625, 2.828125, 2.734375, 6.671875, 6.65625, 5.734375, 7.328125, 7.328125, 7.0625,
      6.140625, 5.109375, 4.71875, 3.484375, 3.484375, 3.734375, 4.375, 5.0, 5.203125,
    ]);
    expect(tags(contours)).toEqual([
      1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 1,
      1, 1, 0, 0, 0, 1,
    ]);
  });

  const base: TestGlyph = { kind: 'simple', contours: [square(0, 0, 100)] };
  const composite = async (glyph: TestGlyph) =>
    (await openFontOutlines(
      buildTestFont({
        unitsPerEm: 100,
        glyphs: [NOTDEF, base, glyph],
        cmap: new Map([[0x41, 2]]),
        cmapFormat: 4,
      })
    ))!.glyphContours(2, 100)!;

  it('offsets and scales a component', async () => {
    const contours = await composite({
      kind: 'composite',
      components: [{ glyph: 1, dx: 50, dy: 20, scale: 0.5 }],
    });
    expect([xs(contours), ys(contours)]).toEqual([
      [50, 50, 100, 100],
      [-20, -70, -70, -20],
    ]);
  });

  it('places a component by matching one of its points to a point of the glyph so far', async () => {
    const contours = await composite({
      kind: 'composite',
      components: [
        { glyph: 1, dx: 0, dy: 0 },
        { glyph: 1, dx: 0, dy: 0, matchPoints: [2, 0] },
      ],
    });
    // Point 2 of the first square is (100, 100), and the second square's point 0 lands there.
    expect(contours.contourEnds).toEqual([3, 7]);
    expect([xs(contours).slice(4), ys(contours).slice(4)]).toEqual([
      [100, 100, 200, 200],
      [-100, -200, -200, -100],
    ]);
  });
});

describe('openFontOutlines glyph without an outline', () => {
  it('gives no contours for the space glyph', async () => {
    const outlines = await openSans();
    expect(outlines.glyphContours(outlines.glyphIndex(0x20), 64)).toBeNull();
  });

  it('gives no contours for a glyph index past the last glyph', async () => {
    expect((await openSans()).glyphContours(9999, 64)).toBeNull();
  });
});
