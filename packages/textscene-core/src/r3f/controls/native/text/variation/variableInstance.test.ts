/**
 * The contours of a variable TrueType font at a `FontVariation` instance: the `gvar` deltas, the
 * `cvar` control values and the instructions' GETVARIATION, against Godot 4.6.3's
 * `font_get_glyph_contours` (`variableInstance.godot.json`, from `/mnt/project-files/variable-font-1138/oracle.gd`).
 */

import { describe, expect, it } from 'vitest';
import autoHintedReference from './autoHintedInstance.godot.json';
import reference from './variableInstance.godot.json';
import {
  readerContours,
  referenceGlyphTitle,
  referencePoints,
  type ReferenceGlyph,
} from '../glyphVariation.testkit';

const instances = reference as unknown as ReferenceGlyph[];
const autoHinted = autoHintedReference as unknown as ReferenceGlyph[];

describe('glyph contours of a variable font at an instance', () => {
  it.each(instances.map((glyph) => [referenceGlyphTitle(glyph), glyph] as const))(
    'match Godot for %s',
    async (_, glyph) => {
      const contours = await readerContours(glyph);

      expect(referencePoints(contours.points)).toEqual(glyph.points);
      expect(contours.contourEnds).toEqual(glyph.contourEnds);
    }
  );
});

describe('glyph contours of an auto-hinted variable font at an instance', () => {
  it.each(autoHinted.map((glyph) => [referenceGlyphTitle(glyph), glyph] as const))(
    'match Godot for %s',
    async (_, glyph) => {
      const contours = await readerContours(glyph);

      expect(referencePoints(contours.points)).toEqual(glyph.points);
      expect(contours.contourEnds).toEqual(glyph.contourEnds);
    }
  );
});
