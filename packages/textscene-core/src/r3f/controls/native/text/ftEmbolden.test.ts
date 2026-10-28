/**
 * `FT_Outline_Embolden` against Godot 4.6.3: `ftEmbolden.godot.json` holds the contours that
 * `TextServer.font_get_glyph_contours` returns for a `FontVariation` at each embolden.
 */

import { describe, expect, it } from 'vitest';
import reference from './ftEmbolden.godot.json';
import { emboldenOutline } from './ftEmbolden';
import { scaledOutlineContours, type ContourTag, type ScaledOutline } from './glyphContours';
import { openFontOutlines } from './sfntOutlines';
import { fixtureFontBytes } from './sfntOutlines.testkit';

interface ReferenceGlyph {
  font: string;
  char: string;
  sizePx: number;
  embolden: number;
  contourEnds: number[];
  isFillRight: boolean;
  /** `[x, y, tag]` as Godot's `font_get_glyph_contours` returns them. */
  points: [number, number, number][];
}

const glyphs = reference as ReferenceGlyph[];
const emboldenedGlyphs = glyphs.filter((glyph) => glyph.embolden > 0);
const title = (glyph: ReferenceGlyph): string =>
  `${glyph.font} ${glyph.char} at ${glyph.sizePx} px, embolden ${glyph.embolden}`;

/** The reference of the same glyph without embolden: Godot's hinted outline before `FT_Outline_Embolden`. */
function plainGlyph(glyph: ReferenceGlyph): ReferenceGlyph {
  const plain = glyphs.find(
    (other) =>
      other.embolden === 0 &&
      other.font === glyph.font &&
      other.char === glyph.char &&
      other.sizePx === glyph.sizePx
  );
  if (!plain) throw new Error(`expected a reference without embolden for ${title(glyph)}`);
  return plain;
}

function toScaledOutline({ points, contourEnds }: ReferenceGlyph): ScaledOutline {
  return {
    x: points.map(([x]) => x * 64),
    y: points.map(([, y]) => -y * 64),
    tags: points.map(([, , tag]) => tag as ContourTag),
    contourEnds: [...contourEnds],
  };
}

/** The points with `-0` turned into `0`, as the JSON reference holds them. */
function referencePoints(points: readonly { x: number; y: number; tag: number }[]): number[][] {
  return points.map(({ x, y, tag }) => [x + 0, y + 0, tag]);
}

describe('emboldenOutline', () => {
  it.each(emboldenedGlyphs.map((glyph) => [title(glyph), glyph] as const))(
    'grows the outline of %s as Godot does',
    (_, glyph) => {
      const outline = toScaledOutline(plainGlyph(glyph));

      emboldenOutline(outline, glyph.embolden, glyph.sizePx);

      const contours = scaledOutlineContours(outline);
      expect(referencePoints(contours.points)).toEqual(glyph.points);
      expect(contours.contourEnds).toEqual(glyph.contourEnds);
      expect(contours.isFillRight).toBe(glyph.isFillRight);
    }
  );

  it('leaves an outline whose orientation FreeType cannot tell as it is', () => {
    const outline: ScaledOutline = { x: [0, 64, 128], y: [0, 0, 0], tags: [1, 1, 1], contourEnds: [2] };

    emboldenOutline(outline, 1, 16);

    expect(outline.x).toEqual([0, 64, 128]);
    expect(outline.y).toEqual([0, 0, 0]);
  });
});

describe('glyph contours of an emboldened CFF font', () => {
  it.each(
    emboldenedGlyphs
      .filter((glyph) => glyph.font.endsWith('.otf'))
      .map((glyph) => [title(glyph), glyph] as const)
  )('matches Godot for %s', async (_, glyph) => {
    const outlines = (await openFontOutlines(fixtureFontBytes(glyph.font)))!;

    const contours = outlines.glyphContours(
      outlines.glyphIndex(glyph.char.codePointAt(0)!),
      glyph.sizePx,
      glyph.embolden
    )!;

    expect(referencePoints(contours.points)).toEqual(glyph.points);
    expect(contours.contourEnds).toEqual(glyph.contourEnds);
  });
});
