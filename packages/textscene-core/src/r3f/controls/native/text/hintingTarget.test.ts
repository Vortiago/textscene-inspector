/**
 * A glyph that loads for a font's `hinting` covers the pixels of the glyph bitmap Godot 4.6.3 draws
 * at that hinting (`text_server_adv.cpp:1270-1282`), as `hintingTarget.godot.json` holds them with
 * subpixel positioning off. The light target auto-hints a TrueType font, hints a CFF font natively
 * and leaves a tricky font to its own hints. `autofit-scripts-test.ttf` holds CJK glyphs.
 */
import { describe, expect, it } from 'vitest';
import reference from './hintingTarget.godot.json';
import { glyphBitmapGrid, rasteriseGlyph, type BitmapGrid } from './ftGrays';
import type { GlyphContours } from './glyphContours';
import { charContours, fixtureFontBytes } from './sfntOutlines.testkit';
import { openFontOutlines } from './sfntOutlines';
import type { FontHinting } from '../../../../godot/text/textServerEnums';

interface ReferenceBitmap {
  font: string;
  char: string;
  sizePx: number;
  hinting: FontHinting;
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
  (bitmap) => [`${bitmap.font} ${bitmap.char} at ${bitmap.sizePx} px, ${bitmap.hinting}`, bitmap] as const
);

async function glyphContoursOf(bitmap: ReferenceBitmap): Promise<GlyphContours> {
  const load = { hinting: bitmap.hinting, isAutohinterForced: false };
  const outlines = (await openFontOutlines(fixtureFontBytes(bitmap.font), load))!;
  return charContours(outlines, bitmap.char, bitmap.sizePx);
}

const gridOf = (bitmap: ReferenceBitmap): BitmapGrid => ({
  left: bitmap.offset[0],
  top: bitmap.offset[1],
  width: bitmap.coverage[0]!.length,
  height: bitmap.coverage.length,
});

async function ourCoverage(bitmap: ReferenceBitmap): Promise<number[][]> {
  const grid = gridOf(bitmap);
  const coverage = rasteriseGlyph(await glyphContoursOf(bitmap), grid);
  return Array.from({ length: grid.height }, (_, row) =>
    Array.from(coverage.subarray(row * grid.width, (row + 1) * grid.width))
  );
}

describe('glyph bitmaps at the font hinting', () => {
  it.each(cases)('match Godot for %s', async (_, bitmap) => {
    expect(await ourCoverage(bitmap)).toEqual(bitmap.coverage);
  });

  it.each(cases)('sit where Godot places them for %s', async (_, bitmap) => {
    const { left, top, width, height } = gridOf(bitmap);
    expect(glyphBitmapGrid(await glyphContoursOf(bitmap))).toEqual({
      left: left + GODOT_GLYPH_MARGIN,
      top: top + GODOT_GLYPH_MARGIN,
      width: width - 2 * GODOT_GLYPH_MARGIN,
      height: height - 2 * GODOT_GLYPH_MARGIN,
    });
  });
});
