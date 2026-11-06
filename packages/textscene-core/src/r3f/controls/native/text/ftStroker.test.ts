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
import { contoursScaledOutline, type GlyphContours } from './glyphContours';
import { ContourPointTag, Hinting } from '../../../../godot/text/textServerEnums';
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
  const load = { hinting: Hinting.LIGHT, isAutohinterForced: false };
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

/** A contour of 26.6 points, y up, as GlyphContours in px. */
function polygon(points: readonly (readonly [number, number])[]): GlyphContours {
  return {
    points: points.map(([x, y]) => ({ x: x / 64, y: -y / 64, tag: ContourPointTag.ON })),
    contourEnds: [points.length - 1],
    isFillRight: true,
  };
}

describe('strokeGlyphContours', () => {
  // A spread of this many points into `splice` exceeds the engine's argument limit (RangeError).
  it('strokes a contour of more points than a call takes as arguments', () => {
    const POINT_COUNT = 200_000;
    const RADIUS = 1_000_000;
    const ring = Array.from({ length: POINT_COUNT }, (_, i): [number, number] => {
      const angle = (2 * Math.PI * i) / POINT_COUNT;
      return [Math.round(RADIUS * Math.cos(angle)), Math.round(RADIUS * Math.sin(angle))];
    });

    const stroked = strokeGlyphContours(polygon(ring), 1);

    expect(stroked.contourEnds).toHaveLength(2);
  });

  // `ft_stroke_border_lineto` returns before it sets `movable` for a line within 2/64 px, so the
  // corner point before it stays. The points are libfreetype's `FT_Glyph_Stroke` at radius 128.
  it('keeps the corner point before a line too short to draw', () => {
    const contour = polygon([
      [-24, 184],
      [-24, 184],
      [-24, 185],
      [-24, 186],
      [-25, 186],
      [-24, 185],
      [-23, 184],
    ]);
    const stroked = contoursScaledOutline(strokeGlyphContours(contour, 2));

    expect(stroked.x).toEqual([
      -151, -152, -24, 66, 68, 105, 105, 74, 26, -22, -77, -114, -116, -153, -163, -143, -123, -77, -24, 47,
      104, 104,
    ]);
    expect(stroked.y).toEqual([
      184, 186, 58, 277, 275, 184, 132, 86, 66, 46, 56, 93, 95, 132, 187, 235, 283, 314, 314, 314, 257, 186,
    ]);
    expect(stroked.contourEnds).toEqual([4, 21]);
  });
});
