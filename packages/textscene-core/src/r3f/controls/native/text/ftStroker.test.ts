/**
 * A glyph outline stroked at a Label's `outline_size` covers the pixels of the stroked glyph bitmap
 * Godot 4.6.3 draws (`text_server_adv.cpp:1377-1393`), as `ftStroker.godot.json` holds them at the
 * light hinting with subpixel positioning off. `montserrat-extra-bold.otf` strokes cubics.
 */
import { describe, expect, it } from 'vitest';
import reference from './ftStroker.godot.json';
import { glyphBitmapGrid } from './ftGrays';
import { strokeGlyphContours } from './ftStroker';
import { coverageRows, freeTypeGrid, type GodotGlyphBitmap } from './glyphBitmap.testkit';
import type { GlyphContours } from './glyphContours';
import { charContours, fixtureFontBytes } from './sfntOutlines.testkit';
import { openFontOutlines } from './sfntOutlines';
import { outlineStrokeWidthPx } from './textOutline';

interface ReferenceBitmap extends GodotGlyphBitmap {
  outlineSize: number;
}

const bitmaps = reference as ReferenceBitmap[];
const cases = bitmaps.map(
  (bitmap) =>
    [`${bitmap.font} ${bitmap.char} at ${bitmap.sizePx} px, outline ${bitmap.outlineSize}`, bitmap] as const
);

async function strokedContoursOf(bitmap: ReferenceBitmap): Promise<GlyphContours> {
  const load = { hinting: 'light', isAutohinterForced: false } as const;
  const outlines = (await openFontOutlines(fixtureFontBytes(bitmap.font), load))!;
  const contours = charContours(outlines, bitmap.char, bitmap.sizePx);
  return strokeGlyphContours(contours, outlineStrokeWidthPx(bitmap.outlineSize) / 2);
}

describe('stroked glyph bitmaps', () => {
  it.each(cases)('match Godot for %s', async (_, bitmap) => {
    expect(coverageRows(await strokedContoursOf(bitmap), bitmap)).toEqual(bitmap.coverage);
  });

  it.each(cases)('sit where Godot places them for %s', async (_, bitmap) => {
    expect(glyphBitmapGrid(await strokedContoursOf(bitmap))).toEqual(freeTypeGrid(bitmap));
  });
});
