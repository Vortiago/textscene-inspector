/**
 * The outline changes Godot runs on a glyph slot for a `FontVariation`, embolden then the
 * `variation_transform` shear (`text_server_adv.cpp:3616-3624`), against the contours of Godot 4.6.3
 * in `glyphVariation.godot.json`.
 */

import { describe, expect, it } from 'vitest';
import reference from './glyphVariation.godot.json';
import { variedContours } from './glyphVariation';
import {
  plainReferenceGlyph,
  referenceGlyphTitle,
  referencePoints,
  toScaledOutline,
  type ReferenceGlyph,
} from './glyphVariation.testkit';
import { openFontOutlines } from './sfntOutlines';
import { fixtureFontBytes } from './sfntOutlines.testkit';

const shearedGlyphs = reference as ReferenceGlyph[];
const cases = shearedGlyphs.map((glyph) => [referenceGlyphTitle(glyph), glyph] as const);

describe('variedContours', () => {
  it.each(cases)('shears the outline of %s as Godot does', (_, glyph) => {
    const outline = toScaledOutline(plainReferenceGlyph(glyph));

    const contours = variedContours(outline, glyph, glyph.sizePx);

    expect(referencePoints(contours.points)).toEqual(glyph.points);
    expect(contours.contourEnds).toEqual(glyph.contourEnds);
    expect(contours.isFillRight).toBe(glyph.isFillRight);
  });

  it('leaves the outline as it is for no embolden and no skew', () => {
    const glyph = plainReferenceGlyph(shearedGlyphs[0]!);

    const contours = variedContours(toScaledOutline(glyph), {}, glyph.sizePx);

    expect(referencePoints(contours.points)).toEqual(glyph.points);
  });
});

describe('glyph contours of a sheared CFF font', () => {
  it.each(cases.filter(([, glyph]) => glyph.font.endsWith('.otf')))(
    'match Godot for %s',
    async (_, glyph) => {
      const outlines = (await openFontOutlines(fixtureFontBytes(glyph.font)))!;

      const contours = outlines.glyphContours(
        outlines.glyphIndex(glyph.char.codePointAt(0)!),
        glyph.sizePx,
        glyph
      )!;

      expect(referencePoints(contours.points)).toEqual(glyph.points);
    }
  );
});
