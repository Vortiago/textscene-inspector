/**
 * The glyph a character draws at one instance of a variable font. HarfBuzz swaps glyphs by the
 * `rvrn` feature of the `GSUB` `FeatureVariations` record whose conditions hold at the instance's
 * coordinates, and Godot shapes every font so (`text_server_adv.cpp:1915-1950` sets them).
 */

import { perObject } from '../../../../../utils/perObject';
import { featureSubstitutionAt, sfntGsub, type FeatureSubstitution } from '../autofit/openTypeLayout';
import { rvrnGlyph, rvrnLookups } from '../autofit/openTypeShaping';
import type { SfntFile } from '../sfntTables';
import type { FontInstance } from './fontInstance';
import { fixedToFdot14 } from './fixedPoint';

/** The glyph of a character at an instance, or at the default instance for null. */
export type InstanceGlyphIndex = (codePoint: number, instance: FontInstance | null) => number;

/** The `rvrn` lookups of one `FeatureVariations` record, and the glyph each character has under them. */
interface RecordGlyphs {
  readonly lookups: readonly number[];
  readonly glyphs: Map<number, number>;
}

/**
 * `glyphIndex`, changed by the `rvrn` stage at an instance, and kept for each `FeatureVariations`
 * record. A font with none draws the glyph `cmap` gives at every instance.
 */
export function instanceGlyphIndex(
  sfnt: SfntFile,
  glyphIndex: (codePoint: number) => number
): InstanceGlyphIndex {
  const gsub = sfntGsub(sfnt);
  if (!gsub || gsub.featureSubstitutions.length === 0) return (codePoint) => glyphIndex(codePoint);
  const face = { glyphIndex, gsub, gpos: null };
  const defaultRecord = featureSubstitutionAt(gsub, []);
  const recordOf = perObject((instance: FontInstance) =>
    featureSubstitutionAt(gsub, Array.from(instance.normalized, fixedToFdot14))
  );
  const byRecord = new Map<FeatureSubstitution | undefined, RecordGlyphs>();
  const glyphsOf = (record: FeatureSubstitution | undefined): RecordGlyphs => {
    let found = byRecord.get(record);
    if (!found) byRecord.set(record, (found = { lookups: rvrnLookups(gsub, record), glyphs: new Map() }));
    return found;
  };
  return (codePoint, instance) => {
    const { lookups, glyphs } = glyphsOf(instance ? recordOf(instance) : defaultRecord);
    let glyph = glyphs.get(codePoint);
    if (glyph === undefined) glyphs.set(codePoint, (glyph = rvrnGlyph(face, codePoint, lookups)));
    return glyph;
  };
}
