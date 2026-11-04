/**
 * The outline of a glyph that FreeType's auto-hinter fits to the grid, as Godot loads it for a font
 * with no TrueType hints (`text_server_adv.cpp:3613`), against the contours of Godot 4.6.3 in
 * `autoHinting.godot.json`.
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
