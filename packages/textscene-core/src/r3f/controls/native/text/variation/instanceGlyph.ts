/**
 * The glyph a character draws at one instance of a variable font, and the glyphs of a run of them.
 * HarfBuzz swaps glyphs by the `rvrn` feature of the `GSUB` `FeatureVariations` record whose
 * conditions hold at the instance's coordinates, and Godot shapes every font so
 * (`text_server_adv.cpp:1915-1950` sets them).
 */

import { perObject } from '../../../../../utils/perObject';
import { featureSubstitutionAt, type FeatureSubstitution, sfntGsub } from '../autofit/openTypeLayout';
import { keptRunSubstitutions, type RunSubstitutions, sfntRunShapingFace } from '../glyphRun';
import { featureLookups, FIRST_STAGE_FEATURES } from '../autofit/openTypeFeatures';
import { applyGsub, type GsubBuffer } from '../autofit/openTypeGsub';
import { scriptTagsOf } from '../autofit/afScripts';
import type { ShapingFace } from '../autofit/openTypeShaping';
import { orOnRangeError } from '../sfntCmap';
import type { SfntFile } from '../sfntTables';
import type { FontInstance } from './fontInstance';
import { featureSubstitutionOfInstance } from './instanceRecord';

/** The glyph of a character at an instance, or at the default instance for null. */
export type InstanceGlyphIndex = (codePoint: number, instance: FontInstance | null) => number;

/**
 * The glyph HarfBuzz's `rvrn` stage gives `codePoint` alone, under the lookups of `substitution`, the
 * `FeatureVariations` record of the instance, for the script of the character. It is the glyph `cmap`
 * gives, unless the lookups turn it into exactly one other glyph.
 */
function rvrnGlyph(
  face: Pick<ShapingFace, 'glyphIndex' | 'gsub'>,
  codePoint: number,
  substitution: FeatureSubstitution | undefined
): number {
  const glyph = face.glyphIndex(codePoint);
  if (!face.gsub || glyph === 0) return glyph;
  const lookups = featureLookups(face.gsub, scriptTagsOf(codePoint), FIRST_STAGE_FEATURES, substitution);
  if (lookups.length === 0) return glyph;
  const buffer: GsubBuffer = { glyphs: [glyph], randomState: 1 };
  applyGsub(face.gsub, [{ lookups, randomLookups: new Set() }], buffer);
  return buffer.glyphs.length === 1 ? buffer.glyphs[0]! : glyph;
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
    featureSubstitutionOfInstance(gsub, instance.normalized)
  );
  const glyphsByRecord = new Map<FeatureSubstitution | undefined, Map<number, number>>();
  return (codePoint, instance) => {
    const record = instance ? recordOf(instance) : defaultRecord;
    let glyphs = glyphsByRecord.get(record);
    if (!glyphs) glyphsByRecord.set(record, (glyphs = new Map()));
    let glyph = glyphs.get(codePoint);
    if (glyph === undefined) {
      const cmapGlyph = glyphIndex(codePoint);
      glyphs.set(codePoint, (glyph = orOnRangeError(() => rvrnGlyph(face, codePoint, record), cmapGlyph)));
    }
    return glyph;
  };
}

/**
 * The run shaping of `sfnt` at each instance, under the lookups of the instance's `FeatureVariations`
 * record, kept for each record. Null for a font with no `GSUB` or no `cmap`.
 */
export function instanceRunSubstitutions(
  sfnt: SfntFile
): ((instance: FontInstance) => RunSubstitutions) | null {
  const face = sfntRunShapingFace(sfnt);
  if (!face) return null;
  const { gsub } = face;
  const byRecord = new Map<FeatureSubstitution | undefined, RunSubstitutions>();
  return perObject((instance: FontInstance) => {
    const record = featureSubstitutionOfInstance(gsub, instance.normalized);
    let substitutions = byRecord.get(record);
    if (!substitutions) byRecord.set(record, (substitutions = keptRunSubstitutions(face, record)));
    return substitutions;
  });
}
