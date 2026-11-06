/**
 * The glyphs of a run of characters as HarfBuzz shapes the run whole: each cluster of a base and
 * its marks normalised against the font (`canonicalGlyphs.ts`), then the `GSUB` lookups of
 * HarfBuzz's default features over the whole run, each skipping the glyphs its flag ignores. Godot
 * hands each run to HarfBuzz (`_shape_run`, `text_server_adv.cpp:7011`), so a ligature, a contextual
 * swap and a multiple substitution read every character of the run.
 */

import { perObject } from '../../../../utils/perObject';
import { recentlyRead } from '../../../../utils/recentlyRead';
import { scriptTagsOf } from './autofit/afScripts';
import { defaultSubstitution } from './autofit/openTypeFeatures';
import { glyphFilterOf, MARK_PROPS } from './autofit/openTypeGdef';
import { type FeatureSubstitution, sfntGsub } from './autofit/openTypeLayout';
import type { GlyphFilter } from './autofit/openTypeGsub';
import { type GsubFace, gsubStages, substitutedGlyphs } from './autofit/openTypeShaping';
import { isCombiningMark, normalisedCharacters } from './canonicalGlyphs';
import { orOnRangeError, sfntGlyphIndex, sfntMapsGlyph } from './sfntCmap';
import { glyphMetricsReader } from './sfntGlyphMetrics';
import type { SfntFile } from './sfntTables';
import { isInstanced, type FontMetrics } from './fontMetrics';

/** A glyph of a shaped cluster. */
export interface RunGlyph {
  /** The font glyph, absent for a face whose glyphs this previewer cannot read: the browser draws `char`. */
  readonly glyph?: number;
  /**
   * The text the glyph draws as where a face draws text: the character it shapes, after normalisation.
   * A glyph a `GSUB` lookup gives that starts its cluster takes the cluster's source text, which no glyph names alone.
   */
  readonly char: string;
  /** Whether the glyph is a mark, which takes no advance and sits over the glyph before it. */
  readonly isMark: boolean;
  /** The glyph's advance at the default instance, design units, where the face reads it. */
  readonly advanceUnits?: number;
}

/** The glyphs one cluster of a run draws, in order. */
export interface RunCluster {
  /** The index in the run of the cluster's first character. */
  readonly start: number;
  /** The index past its last character. */
  readonly end: number;
  readonly glyphs: readonly RunGlyph[];
}

/**
 * The clusters of `chars`, in run order. An empty string in `chars` holds no character: the second
 * unit of a surrogate pair, or a character the caller draws apart, which no cluster takes.
 */
export type RunShaping = (chars: readonly string[]) => readonly RunCluster[];

/** The tables a run shaping reads: the `GSUB` and its lookup flags, the characters the font maps, and the advance of each glyph. */
export interface RunShapingFace extends GsubFace {
  readonly filter: GlyphFilter;
  mapsCharacter(ch: string): boolean;
  advanceUnits(glyph: number): number;
}

/** The face of `sfnt` for run shaping, or null for a font with no `cmap` this previewer reads. */
export function sfntRunShapingFace(sfnt: SfntFile): RunShapingFace | null {
  const glyphIndex = sfntGlyphIndex(sfnt);
  const mapsCharacter = sfntMapsGlyph(sfnt);
  if (!glyphIndex || !mapsCharacter) return null;
  const metricsOf = glyphMetricsReader(sfnt);
  return {
    glyphIndex,
    gsub: sfntGsub(sfnt),
    filter: glyphFilterOf(sfnt),
    mapsCharacter,
    advanceUnits: (glyph) => metricsOf(glyph, 0).horizontal.advance,
  };
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

/** A cluster of a run before shaping: a base and the marks after it. */
interface CharacterCluster {
  readonly start: number;
  readonly end: number;
  readonly characters: readonly string[];
}

/**
 * The clusters of `chars` (`hb_form_clusters`): each mark joins the cluster before it, and a
 * character with no cluster before it starts one.
 */
function characterClusters(chars: readonly string[]): CharacterCluster[] {
  const clusters: { start: number; end: number; characters: string[] }[] = [];
  chars.forEach((ch, i) => {
    if (ch === '') return;
    const last = clusters.at(-1);
    if (last && isCombiningMark(ch)) {
      last.characters.push(ch);
      last.end = i + ch.length;
    } else clusters.push({ start: i, end: i + ch.length, characters: [ch] });
  });
  return clusters;
}

/**
 * The characters a cluster draws as in a face that maps the characters `mapsCharacter` accepts:
 * HarfBuzz's normalisation, or the cluster's own characters where the face cannot draw one of them.
 */
function drawnCharacters(
  { characters }: CharacterCluster,
  mapsCharacter: (ch: string) => boolean
): readonly string[] {
  return normalisedCharacters(characters.join(''), mapsCharacter) ?? characters;
}

/**
 * Shapes `chars` through the `GSUB` lookups of HarfBuzz's default features, under the lookups of
 * `substitution`, the `FeatureVariations` record of an instance. Each shaped cluster covers the
 * clusters a lookup merged into it.
 */
function shapeRun(
  face: RunShapingFace,
  chars: readonly string[],
  substitution: FeatureSubstitution | undefined
): RunCluster[] {
  const clusters = characterClusters(chars);
  const drawn = clusters.map((cluster) => drawnCharacters(cluster, face.mapsCharacter));
  const codePoints = drawn.flatMap((characters) => characters.map((ch) => ch.codePointAt(0)!));
  const clusterIndices = drawn.flatMap((characters, k) => characters.map(() => k));
  const stages = face.gsub ? gsubStages(face.gsub, runScriptTags(codePoints), null, substitution) : [];
  const buffer = substitutedGlyphs(face, codePoints, stages, clusterIndices);
  const shaped: RunCluster[] = [];
  const bufferClusters = buffer.clusters!;
  for (let first = 0; first < buffer.glyphs.length;) {
    const k = bufferClusters[first]!;
    let next = first + 1;
    while (next < buffer.glyphs.length && bufferClusters[next] === k) next++;
    const nextCluster = next < buffer.glyphs.length ? bufferClusters[next]! : clusters.length;
    const start = clusters[k]!.start;
    const end = clusters[nextCluster - 1]!.end;
    const glyphs: RunGlyph[] = [];
    for (let j = first; j < next; j++) {
      const glyph = buffer.glyphs[j]!;
      const codePoint = buffer.codePoints![j]!;
      const isSubstitutedStart = j === first && glyph !== face.glyphIndex(codePoint);
      const char = isSubstitutedStart ? chars.slice(start, end).join('') : String.fromCodePoint(codePoint);
      glyphs.push(runGlyph(face, glyph, codePoint, char));
    }
    shaped.push({ start, end, glyphs });
    first = next;
  }
  return shaped;
}

function runGlyph(face: RunShapingFace, glyph: number, codePoint: number, char: string): RunGlyph {
  return {
    glyph,
    char,
    isMark: (face.filter.propsOf({ glyph, codePoint }) & MARK_PROPS) !== 0,
    advanceUnits: face.advanceUnits(glyph),
  };
}

/**
 * The run shaping of a face whose glyphs this previewer cannot read: each cluster normalised against
 * the characters `hasCharacter` accepts, with no `GSUB`. The browser shapes the text it draws.
 */
function characterRunShaping(hasCharacter: (ch: string) => boolean): RunShaping {
  return (chars) =>
    characterClusters(chars).map((cluster) => ({
      start: cluster.start,
      end: cluster.end,
      glyphs: drawnCharacters(cluster, hasCharacter).map((char) => ({
        char,
        isMark: isCombiningMark(char),
      })),
    }));
}

/** A layout shapes the same runs again on every edit of its text, so the clusters of this many runs are kept. */
const MAX_KEPT_RUNS = 256;

/** A key for `chars` that keeps where each empty string stands, with a noncharacter as the separator. */
const runKey = (chars: readonly string[]): string => chars.join('￿');

/**
 * The run shaping of `face` under the lookups of `substitution`, keeping the clusters of the runs read
 * most recently. A table that a corrupt offset reads past shapes no lookup, as HarfBuzz reads a table
 * it cannot sanitise as empty.
 */
export function keptRunShaping(
  face: RunShapingFace,
  substitution: FeatureSubstitution | undefined
): RunShaping {
  const kept = recentlyRead<string, readonly RunCluster[]>(MAX_KEPT_RUNS);
  const unshaped = characterRunShaping(face.mapsCharacter);
  return (chars) =>
    kept(
      runKey(chars),
      () => orOnRangeError(() => shapeRun(face, chars, substitution), null) ?? unshaped(chars)
    );
}

/** The run shaping of `sfnt` at its default instance, or null for a font with no `cmap` this previewer reads. */
export function sfntRunShaping(sfnt: SfntFile): RunShaping | null {
  const face = sfntRunShapingFace(sfnt);
  return face && keptRunShaping(face, face.gsub ? defaultSubstitution(face.gsub) : undefined);
}

/** The run shaping of a face with no `shaping`, kept per face so its clusters normalise against its `hasGlyph`. */
const unshapedRuns = perObject((metrics: FontMetrics) => characterRunShaping((ch) => metrics.hasGlyph(ch)));

/**
 * The clusters of `chars` and the glyphs each draws: at the axis values of the face's
 * `variation_opentype` where its outlines shape them, else at the default instance.
 */
export function getFontRunShaping(metrics: FontMetrics, chars: readonly string[]): readonly RunCluster[] {
  const { outlines, opentype } = metrics;
  const atInstance = isInstanced(opentype) ? outlines?.shapingAt?.(chars, opentype) : null;
  return atInstance ?? (metrics.shaping ?? unshapedRuns(metrics))(chars);
}
