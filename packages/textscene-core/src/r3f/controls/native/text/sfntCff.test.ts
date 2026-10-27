import { describe, expect, it } from 'vitest';
import { ContourPointTag } from '../../../../godot/text/textServerEnums';
import type { GlyphContours } from './glyphContours';
import { parseSfntOutlines } from './sfntOutlines';
import { fixtureFontBytes } from './sfntOutlines.testkit';

/** Montserrat ExtraBold, 1000 units per em, as an OpenType-CFF file. */
function montserrat() {
  const outlines = parseSfntOutlines(fixtureFontBytes('montserrat-extra-bold.otf'));
  if (!outlines) throw new Error('the Montserrat fixture does not parse');
  return outlines;
}

function contoursOf(char: string, fontSizePx: number): GlyphContours {
  const outlines = montserrat();
  const contours = outlines.glyphContours(outlines.glyphIndex(char.codePointAt(0)!), fontSizePx);
  if (!contours) throw new Error(`no outline for ${char}`);
  return contours;
}

const xs = (contours: GlyphContours) => contours.points.map((p) => p.x);
/** The tags as text: `o` for an ON point and `c` for a cubic control point. */
const tagText = (contours: GlyphContours) =>
  contours.points.map((p) => (p.tag === ContourPointTag.ON ? 'o' : 'c')).join('');

describe('parseSfntOutlines CFF glyph', () => {
  it('reads the points of H at 64 px with the x Godot measured', () => {
    // x: `font_get_glyph_contours` of this font at size 64 in Godot 4.6.3. Godot hints y to whole
    // pixels (45 for the cap height), which the reader leaves out.
    expect(xs(contoursOf('H', 64))).toEqual([
      46.328125, 46.328125, 33.015625, 33.015625, 17.078125, 17.078125, 3.765625, 3.765625, 17.078125,
      17.078125, 33.015625, 33.015625,
    ]);
  });

  it('reads the curves of O at 64 px as the tags, contour ends and x Godot measured', () => {
    // Each of the eight segments of both contours is an ON point and two cubic control points.
    const contours = contoursOf('O', 64);
    expect(contours.contourEnds).toEqual([11, 23]);
    expect(tagText(contours)).toBe('occoccoccoccoccoccoccocc');
    expect(xs(contours)).toEqual([
      25.65625, 11.578125, 1.203125, 1.203125, 1.203125, 11.578125, 25.65625, 39.734375, 50.09375, 50.09375,
      50.09375, 39.734375, 25.84375, 31.734375, 36.46875, 36.46875, 36.46875, 31.734375, 25.84375, 19.953125,
      14.84375, 14.84375, 14.84375, 19.890625,
    ]);
  });

  it('reads a glyph that mixes lines and curves, g, at 64 px as Godot measured', () => {
    const contours = contoursOf('g', 64);
    expect(contours.contourEnds).toEqual([28, 40]);
    expect(tagText(contours)).toBe('oooccoccoccoccooccoccooccoccooccoccoccocc');
    expect(xs(contours)).toEqual([
      37.9375, 25.140625, 25.140625, 22.90625, 19.640625, 15.546875, 7.15625, 1.203125, 1.203125, 1.203125,
      7.359375, 15.796875, 19.765625, 22.90625, 25.140625, 25.140625, 25.140625, 22.390625, 17.71875,
      14.140625, 10.109375, 7.03125, 2.75, 6.515625, 12.34375, 18.8125, 30.203125, 37.9375, 37.9375, 19.1875,
      15.671875, 13.296875, 13.296875, 13.296875, 15.671875, 19.1875, 22.78125, 25.140625, 25.140625,
      25.140625, 22.78125,
    ]);
  });
});
