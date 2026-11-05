/**
 * A glyph that loads for a font's `hinting` covers the pixels of the glyph bitmap Godot 4.6.3 draws
 * at that hinting (`text_server_adv.cpp:1270-1282`), as `hintingTarget.godot.json` holds them with
 * subpixel positioning off. The light target auto-hints a TrueType font, hints a CFF font natively
 * and leaves a tricky font to its own hints. `autofit-scripts-test.ttf` holds CJK glyphs.
 */
import { describe, expect, it } from 'vitest';
import reference from './hintingTarget.godot.json';
import { freeTypeCoverage } from './freeTypeCoverage.testkit';
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
 * FreeType floors where a chord crosses a pixel edge, and this rasteriser covers by exact area. That
 * moves a pixel at a thin joint by up to 9 levels, and the mean by under 0.3. A hint of 1/64 px
 * moves the mean of a glyph by more than 1.
 */
const LARGEST_LEVEL_DIFFERENCE = 10;
const LARGEST_MEAN_LEVEL_DIFFERENCE = 0.3;

const bitmaps = reference as ReferenceBitmap[];
const cases = bitmaps.map(
  (bitmap) => [`${bitmap.font} ${bitmap.char} at ${bitmap.sizePx} px, ${bitmap.hinting}`, bitmap] as const
);

async function ourCoverage(bitmap: ReferenceBitmap): Promise<number[][]> {
  const load = { hinting: bitmap.hinting, isAutohinterForced: false };
  const outlines = (await openFontOutlines(fixtureFontBytes(bitmap.font), load))!;
  const [left, top] = bitmap.offset;
  const grid = { left, top, width: bitmap.coverage[0]!.length, height: bitmap.coverage.length };
  return freeTypeCoverage(charContours(outlines, bitmap.char, bitmap.sizePx), grid);
}

/** The difference of each pixel between two bitmaps of one size. */
const levelDifferences = (ours: number[][], godot: number[][]): number[] =>
  godot.flatMap((row, y) => row.map((level, x) => Math.abs(level - ours[y]![x]!)));

describe('glyph bitmaps at the font hinting', () => {
  it.each(cases)('match Godot for %s', async (_, bitmap) => {
    const differences = levelDifferences(await ourCoverage(bitmap), bitmap.coverage);
    const mean = differences.reduce((sum, difference) => sum + difference, 0) / differences.length;

    expect(Math.max(...differences)).toBeLessThanOrEqual(LARGEST_LEVEL_DIFFERENCE);
    expect(mean).toBeLessThanOrEqual(LARGEST_MEAN_LEVEL_DIFFERENCE);
  });
});
