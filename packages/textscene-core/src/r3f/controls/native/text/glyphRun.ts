/**
 * The glyphs of a run of characters that a font's `GSUB` changes, as HarfBuzz shapes the run as a
 * whole: a ligature of several characters, and a glyph that a lookup swaps by its neighbours. Godot
 * hands each run to HarfBuzz (`_shape_run`, `text_server_adv.cpp:7011`), so a lookup reads every
 * character of the run, where a layout that shaped each character alone would miss it.
 */

import { recentlyRead } from '../../../../utils/recentlyRead';
import { scriptTagsOf } from './autofit/afScripts';
import { defaultSubstitution } from './autofit/openTypeFeatures';
import { applyGsub, type GsubBuffer } from './autofit/openTypeGsub';
import { type FeatureSubstitution, type LayoutTable, sfntGsub } from './autofit/openTypeLayout';
import { gsubStages, type ShapingFace } from './autofit/openTypeShaping';
import { orOnRangeError, sfntGlyphIndex } from './sfntCmap';
import { glyphMetricsReader } from './sfntGlyphMetrics';
import type { SfntFile } from './sfntTables';

/** A cluster of a run that draws one glyph other than the `cmap` glyph of its one character. */
export interface SubstitutedCluster {
  /** The index in the run of the cluster's first character. */
  readonly start: number;
  /** The index past its last character. */
  readonly end: number;
  /** The glyph the cluster draws. */
  readonly glyph: number;
  /** The glyph's advance at the default instance, design units. */
  readonly advanceUnits: number;
}

/**
 * The clusters of `chars` that draw a glyph of their own, in run order. An empty string in `chars`
 * holds no character: the second unit of a surrogate pair, or a character the caller draws apart.
 */
export type RunSubstitutions = (chars: readonly string[]) => readonly SubstitutedCluster[];

/** The tables a run shaping reads: the glyph of each character, the `GSUB`, and the advance of each glyph. */
export interface RunShapingFace extends Pick<ShapingFace, 'glyphIndex'> {
  readonly gsub: LayoutTable;
  advanceUnits(glyph: number): number;
}

/** The face of `sfnt` for run shaping, or null for a font with no `GSUB` or no `cmap`. */
export function sfntRunShapingFace(sfnt: SfntFile): RunShapingFace | null {
  const gsub = sfntGsub(sfnt);
  const glyphIndex = sfntGlyphIndex(sfnt);
  if (!gsub || !glyphIndex) return null;
  const metricsOf = glyphMetricsReader(sfnt);
  return { glyphIndex, gsub, advanceUnits: (glyph) => metricsOf(glyph, 0).horizontal.advance };
}

/**
 * The script HarfBuzz shapes a run in: the script of its first character that has one. Godot splits
 * a run at each change of script, which this previewer does not yet do.
 */
function runScriptTags(codePoints: readonly number[]): readonly string[] {
  for (const codePoint of codePoints) {
    const tags = scriptTagsOf(codePoint);
    if (tags.length > 0) return tags;
  }
  return [];
}

/**
 * Shapes `chars` through the `GSUB` lookups of HarfBuzz's default features, under the lookups of
 * `substitution`, the `FeatureVariations` record of an instance. A cluster that puts out more than
 * one glyph is left out, as the layout draws each of its characters.
 */
export function shapedRunClusters(
  face: RunShapingFace,
  chars: readonly string[],
  substitution: FeatureSubstitution | undefined
): SubstitutedCluster[] {
  const { gsub } = face;
  const clusters: number[] = [];
  const codePoints: number[] = [];
  chars.forEach((ch, i) => {
    if (ch === '') return;
    clusters.push(i);
    codePoints.push(ch.codePointAt(0)!);
  });
  const stages = gsubStages(gsub, runScriptTags(codePoints), null, substitution);
  if (stages.every(({ lookups }) => lookups.length === 0)) return [];
  const cmapGlyphs = codePoints.map((codePoint) => face.glyphIndex(codePoint));
  const cmapGlyphAt: number[] = [];
  clusters.forEach((start, k) => (cmapGlyphAt[start] = cmapGlyphs[k]!));
  const buffer: GsubBuffer = { glyphs: cmapGlyphs, randomState: 1, clusters };
  applyGsub(gsub, stages, buffer);
  return changedClusters(face, chars, buffer, cmapGlyphAt);
}

/** The clusters of a shaped buffer whose one glyph differs from the `cmap` glyph of a cluster of one character. */
function changedClusters(
  face: RunShapingFace,
  chars: readonly string[],
  { glyphs, clusters }: GsubBuffer,
  cmapGlyphAt: readonly number[]
): SubstitutedCluster[] {
  const changed: SubstitutedCluster[] = [];
  for (let first = 0; first < glyphs.length;) {
    const start = clusters![first]!;
    let next = first + 1;
    while (next < glyphs.length && clusters![next] === start) next++;
    const end = next < glyphs.length ? clusters![next]! : chars.length;
    const glyph = glyphs[first]!;
    const isOneCharacter = chars.slice(start + 1, end).every((ch) => ch === '');
    const isOneGlyph = next - first === 1;
    if (isOneGlyph && !(isOneCharacter && glyph === cmapGlyphAt[start]))
      changed.push({ start, end, glyph, advanceUnits: face.advanceUnits(glyph) });
    first = next;
  }
  return changed;
}

/** A layout shapes the same runs again on every edit of its text, so the clusters of this many runs are kept. */
const MAX_KEPT_RUNS = 256;

/** A key for `chars` that keeps where each empty string stands, with a noncharacter as the separator. */
const runKey = (chars: readonly string[]): string => chars.join('￿');

/**
 * The run shaping of `face` under the lookups of `substitution`, keeping the clusters of the runs read
 * most recently. A table that a corrupt offset reads past shapes nothing, as HarfBuzz reads a table it
 * cannot sanitise as empty.
 */
export function keptRunSubstitutions(
  face: RunShapingFace,
  substitution: FeatureSubstitution | undefined
): RunSubstitutions {
  const kept = recentlyRead<string, readonly SubstitutedCluster[]>(MAX_KEPT_RUNS);
  return (chars) =>
    kept(runKey(chars), () => orOnRangeError(() => shapedRunClusters(face, chars, substitution), []));
}

/** The run shaping of `sfnt` at its default instance, or null for a font with no `GSUB` or no `cmap`. */
export function sfntRunSubstitutions(sfnt: SfntFile): RunSubstitutions | null {
  const face = sfntRunShapingFace(sfnt);
  return face && keptRunSubstitutions(face, defaultSubstitution(face.gsub));
}
