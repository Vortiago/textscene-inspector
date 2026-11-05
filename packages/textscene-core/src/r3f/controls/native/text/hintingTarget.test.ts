/**
 * A glyph that loads for a font's `hinting` covers the pixels of the glyph bitmap Godot 4.6.3 draws
 * at that hinting (`text_server_adv.cpp:1270-1282`), as `hintingTarget.godot.json` holds them with
 * subpixel positioning off. The light target auto-hints a TrueType font, hints a CFF font natively
 * and leaves a tricky font to its own hints. `autofit-scripts-test.ttf` holds CJK glyphs.
 */
import { describe, expect, it } from 'vitest';
import reference from './hintingTarget.godot.json';
import { glyphBitmapGrid } from './ftGrays';
import { coverageRows, freeTypeGrid, type GodotGlyphBitmap } from './glyphBitmap.testkit';
import type { GlyphContours } from './glyphContours';
import { charContours, fixtureFontBytes } from './sfntOutlines.testkit';
import { openFontOutlines } from './sfntOutlines';
import type { FontHinting } from '../../../../godot/text/textServerEnums';

interface ReferenceBitmap extends GodotGlyphBitmap {
  hinting: FontHinting;
}

const bitmaps = reference as ReferenceBitmap[];
const cases = bitmaps.map(
  (bitmap) => [`${bitmap.font} ${bitmap.char} at ${bitmap.sizePx} px, ${bitmap.hinting}`, bitmap] as const
);

async function glyphContoursOf(bitmap: ReferenceBitmap): Promise<GlyphContours> {
  const load = { hinting: bitmap.hinting, isAutohinterForced: false };
  const outlines = (await openFontOutlines(fixtureFontBytes(bitmap.font), load))!;
  return charContours(outlines, bitmap.char, bitmap.sizePx);
}

describe('glyph bitmaps at the font hinting', () => {
  it.each(cases)('match Godot for %s', async (_, bitmap) => {
    expect(coverageRows(await glyphContoursOf(bitmap), bitmap)).toEqual(bitmap.coverage);
  });

  it.each(cases)('sit where Godot places them for %s', async (_, bitmap) => {
    expect(glyphBitmapGrid(await glyphContoursOf(bitmap))).toEqual(freeTypeGrid(bitmap));
  });
});
