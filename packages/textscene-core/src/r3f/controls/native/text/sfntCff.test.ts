import { describe, expect, it } from 'vitest';
import { contourText } from './sfntCff.testkit';
import { openFontOutlines } from './sfntOutlines';
import { fixtureFontBytes } from './sfntOutlines.testkit';

/** Montserrat ExtraBold, 1000 units per em, as an OpenType-CFF file. */
async function montserrat() {
  const outlines = await openFontOutlines(fixtureFontBytes('montserrat-extra-bold.otf'));
  if (!outlines) throw new Error('the Montserrat fixture does not parse');
  return outlines;
}

/** What the glyph of `char` draws at `fontSizePx`: the points of each contour, a cubic control point after a `~`. */
async function drawn(char: string, fontSizePx: number): Promise<string[]> {
  const outlines = await montserrat();
  const contours = outlines.glyphContours(outlines.glyphIndex(char.codePointAt(0)!), fontSizePx);
  if (!contours) throw new Error(`no outline for ${char}`);
  return contourText(contours);
}

// Every expectation is what `font_get_glyph_contours` of Godot 4.6.3 returned for this font.
describe('openFontOutlines CFF glyph', () => {
  it('reads the points of H at 64 px, with the stems on whole pixels', async () => {
    expect(await drawn('H', 64)).toEqual([
      '46.328125,0 46.328125,-45 33.015625,-45 33.015625,-27 17.078125,-27 17.078125,-45 3.765625,-45 3.765625,0 17.078125,0 17.078125,-16.6875 33.015625,-16.6875 33.015625,0',
    ]);
  });

  it('reads the curves of O at 64 px', async () => {
    expect(await drawn('O', 64)).toEqual([
      '25.65625,-45 ~11.578125,-45 ~1.203125,-35.390625 1.203125,-22.125 ~1.203125,-8.78125 ~11.578125,1 25.65625,1 ~39.734375,1 ~50.09375,-8.84375 50.09375,-22.125 ~50.09375,-35.328125 ~39.734375,-45',
      '25.84375,-33.859375 ~31.734375,-33.859375 ~36.46875,-28.890625 36.46875,-22.0625 ~36.46875,-15.21875 ~31.734375,-10.125 25.84375,-10.125 ~19.953125,-10.125 ~14.84375,-15.21875 14.84375,-22.0625 ~14.84375,-28.890625 ~19.890625,-33.859375',
    ]);
  });

  it('reads a glyph that mixes lines and curves, g, at 64 px', async () => {
    expect(await drawn('g', 64)).toEqual([
      '37.9375,-35 25.140625,-35 25.140625,-31.765625 ~22.90625,-34.453125 ~19.640625,-36 15.546875,-36 ~7.15625,-36 ~1.203125,-29.46875 1.203125,-19.203125 ~1.203125,-8.640625 ~7.359375,-2 15.796875,-2 ~19.765625,-2 ~22.90625,-3.46875 25.140625,-6.15625 25.140625,-2.625 ~25.140625,0.78125 ~22.390625,2.953125 17.71875,2.953125 ~14.140625,2.953125 ~10.109375,1.796875 7.03125,-0.25 2.75,8.46875 ~6.515625,10.953125 ~12.34375,13 18.8125,13 ~30.203125,13 ~37.9375,6.796875 37.9375,-3.015625',
      '19.1875,-11.265625 ~15.671875,-11.265625 ~13.296875,-14.296875 13.296875,-18.796875 ~13.296875,-22.921875 ~15.671875,-25.90625 19.1875,-25.90625 ~22.78125,-25.90625 ~25.140625,-22.984375 25.140625,-18.515625 ~25.140625,-14.296875 ~22.78125,-11.265625',
    ]);
  });

  it('drops the last point of a contour only when hinting leaves it on the first point', async () => {
    expect(await drawn('đ', 12)).toEqual([
      '8.203125,-7.078125 8.203125,-9 7.453125,-9 5.03125,-9 4.09375,-9 4.09375,-7.078125 5.03125,-7.078125 5.03125,-6.15625 ~4.578125,-6.6875 ~3.953125,-7 3.1875,-7 ~1.390625,-7 ~0.21875,-5.6875 0.21875,-3.53125 ~0.21875,-1.328125 ~1.421875,0 3.25,0 ~3.984375,0 ~4.59375,-0.296875 5.03125,-0.8125 5.03125,0 7.453125,0 7.453125,-7.078125',
      '3.859375,-1.84375 ~3.140625,-1.84375 ~2.671875,-2.5 2.671875,-3.46875 ~2.671875,-4.421875 ~3.140625,-5.078125 3.859375,-5.078125 ~4.5625,-5.078125 ~5.03125,-4.421875 5.03125,-3.46875 ~5.03125,-2.5 ~4.5625,-1.84375',
    ]);
  });
});
