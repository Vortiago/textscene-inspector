/**
 * A glyph outline stroked at a Label's `outline_size` covers the pixels of the stroked glyph bitmap
 * Godot 4.6.3 draws (`text_server_adv.cpp:1377-1393`), as `ftStroker.godot.json` holds them at the
 * light hinting with subpixel positioning off. `montserrat-extra-bold.otf` strokes cubics.
 */
import { describe, expect, it } from 'vitest';
import reference from './ftStroker.godot.json';
import { glyphBitmapGrid, rasteriseGlyph, type BitmapGrid } from './ftGrays';
import { strokeGlyphContours } from './ftStroker';
import type { GlyphContours } from './glyphContours';
import { charContours, fixtureFontBytes } from './sfntOutlines.testkit';
import { openFontOutlines } from './sfntOutlines';
import { outlineRadiusPx } from './textOutline';

interface ReferenceBitmap {
  font: string;
  char: string;
  sizePx: number;
  outlineSize: number;
  /** `font_get_glyph_offset`: the bitmap's top-left corner in px from the glyph origin, y down. */
  offset: [number, number];
  /** The 8-bit alpha of each pixel, row by row. */
  coverage: number[][];
}

/**
 * Godot's glyph texture holds a margin of one pixel round the FreeType bitmap (`rasterize_bitmap`,
 * `text_server_adv.cpp:1223-1224`), which the reference bitmaps keep.
 */
const GODOT_GLYPH_MARGIN = 1;

const bitmaps = reference as ReferenceBitmap[];
const cases = bitmaps.map(
  (bitmap) =>
    [`${bitmap.font} ${bitmap.char} at ${bitmap.sizePx} px, outline ${bitmap.outlineSize}`, bitmap] as const
);

async function strokedContoursOf(bitmap: ReferenceBitmap): Promise<GlyphContours> {
  const load = { hinting: 'light', isAutohinterForced: false } as const;
  const outlines = (await openFontOutlines(fixtureFontBytes(bitmap.font), load))!;
  const contours = charContours(outlines, bitmap.char, bitmap.sizePx);
  return strokeGlyphContours(contours, outlineRadiusPx(bitmap.outlineSize));
}

const gridOf = (bitmap: ReferenceBitmap): BitmapGrid => ({
  left: bitmap.offset[0],
  top: bitmap.offset[1],
  width: bitmap.coverage[0]!.length,
  height: bitmap.coverage.length,
});

async function ourCoverage(bitmap: ReferenceBitmap): Promise<number[][]> {
  const grid = gridOf(bitmap);
  const coverage = rasteriseGlyph(await strokedContoursOf(bitmap), grid);
  return Array.from({ length: grid.height }, (_, row) =>
    Array.from(coverage.subarray(row * grid.width, (row + 1) * grid.width))
  );
}

describe('stroked glyph bitmaps', () => {
  it.each(cases)('match Godot for %s', async (_, bitmap) => {
    expect(await ourCoverage(bitmap)).toEqual(bitmap.coverage);
  });

  it.each(cases)('sit where Godot places them for %s', async (_, bitmap) => {
    const { left, top, width, height } = gridOf(bitmap);
    expect(glyphBitmapGrid(await strokedContoursOf(bitmap))).toEqual({
      left: left + GODOT_GLYPH_MARGIN,
      top: top + GODOT_GLYPH_MARGIN,
      width: width - 2 * GODOT_GLYPH_MARGIN,
      height: height - 2 * GODOT_GLYPH_MARGIN,
    });
  });
});
