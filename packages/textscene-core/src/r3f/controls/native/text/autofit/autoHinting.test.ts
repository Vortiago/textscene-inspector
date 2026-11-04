/**
 * The outline of a glyph that FreeType's auto-hinter fits to the grid, as Godot loads it
 * (`text_server_adv.cpp:3613`), against the contours of Godot 4.6.3 in `autoHinting.godot.json`:
 * a font with no TrueType hints, a hinted font with `force_autohinter` on, and a tricky font,
 * which keeps FreeType's TrueType loader with it on. `autofit-scripts-test.ttf` maps glyphs of
 * Noto Sans to han, Oriya and Armenian characters, for the CJK, Indic and dummy writing systems.
 */

import { describe, expect, it } from 'vitest';
import reference from './autoHinting.godot.json';
import {
  readerContours,
  referenceGlyphTitle,
  referencePoints,
  type ReferenceGlyph,
} from '../glyphVariation.testkit';

const autoHintedGlyphs = reference as ReferenceGlyph[];
const cases = autoHintedGlyphs.map((glyph) => [referenceGlyphTitle(glyph), glyph] as const);

describe('auto-hinted glyph contours', () => {
  it.each(cases)('match Godot for %s', async (_, glyph) => {
    const contours = await readerContours(glyph);

    expect(referencePoints(contours.points)).toEqual(glyph.points);
    expect(contours.contourEnds).toEqual(glyph.contourEnds);
  });
});
