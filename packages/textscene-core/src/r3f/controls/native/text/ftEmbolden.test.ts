/**
 * `FT_Outline_Embolden` against Godot 4.6.3: `ftEmbolden.godot.json` holds the contours that
 * `TextServer.font_get_glyph_contours` returns for a `FontVariation` at each embolden.
 */

import { describe, expect, it } from 'vitest';
import reference from './ftEmbolden.godot.json';
import { emboldenOutline } from './ftEmbolden';
import { scaledOutlineContours, type ScaledOutline } from './glyphContours';
import {
  plainReferenceGlyph,
  referenceGlyphTitle,
  readerContours,
  referencePoints,
  toScaledOutline,
  type ReferenceGlyph,
} from './glyphVariation.testkit';

const emboldenedGlyphs = (reference as ReferenceGlyph[]).filter((glyph) => glyph.embolden > 0);

describe('emboldenOutline', () => {
  it.each(emboldenedGlyphs.map((glyph) => [referenceGlyphTitle(glyph), glyph] as const))(
    'grows the outline of %s as Godot does',
    (_, glyph) => {
      const outline = toScaledOutline(plainReferenceGlyph(glyph));

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
      .map((glyph) => [referenceGlyphTitle(glyph), glyph] as const)
  )('matches Godot for %s', async (_, glyph) => {
    const contours = await readerContours(glyph);

    expect(referencePoints(contours.points)).toEqual(glyph.points);
    expect(contours.contourEnds).toEqual(glyph.contourEnds);
  });
});
