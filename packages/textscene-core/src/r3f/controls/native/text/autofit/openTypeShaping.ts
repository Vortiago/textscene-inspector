/**
 * The shaping of one cluster of a blue or standard string, as the auto-hinter asks HarfBuzz for it
 * (`af_shaper_get_cluster_hb`): the glyphs `cmap` gives the characters, changed by the `GSUB`
 * lookups of HarfBuzz's default features and the style's own, with the vertical offsets of the
 * single and pair adjustments of `GPOS`. The auto-hinter reads no advance of a contour's glyph.
 *
 * HarfBuzz's script shapers (Arabic joining, Indic reordering, mark positioning) are not ported:
 * a cluster of such a script shapes as the default shaper shapes it. A lookup matches every glyph
 * of the cluster: it skips none by its flag (`openTypeGdef.ts` reads the flags for the kerning at an instance).
 *
 * Portions ported from HarfBuzz ("Old MIT" licence).
 * Copyright (C) 2007-2026 by Behdad Esfahbod and the HarfBuzz contributors.
 * See THIRD-PARTY-NOTICES.md.
 */

import { perObject } from '../../../../../utils/perObject';
import { applyGsub, type GlyphFilter, type GsubBuffer, type GsubStage } from './openTypeGsub';
import {
  defaultSubstitution,
  FIRST_STAGE_FEATURES,
  featureLookups,
  shapingFeatures,
} from './openTypeFeatures';
import {
  coverageIndex,
  type FeatureSubstitution,
  GposType,
  i16,
  type LayoutTable,
  pairValueRecords,
  u16,
  valueFieldOffset,
  ValueFormat,
  valueRecordSize,
} from './openTypeLayout';

/** A shaped glyph: its index and vertical offset in font units. */
export interface ShapedGlyph {
  glyph: number;
  yOffset: number;
}

/** The tables a `GSUB` pass reads: the glyph of each character, the `GSUB`, and how its lookup flags skip glyphs. */
export interface GsubFace {
  glyphIndex(codePoint: number): number;
  readonly gsub: LayoutTable | null;
  /** Absent: each lookup reads every glyph, whatever its flag. */
  readonly filter?: GlyphFilter;
}

export interface ShapingFace extends GsubFace {
  readonly gpos: LayoutTable | null;
}

/**
 * The glyphs `cmap` gives `codePoints`, through the lookups of `stages`, as HarfBuzz's buffer holds
 * them after `GSUB`. `clusters` gives the cluster of each code point, which the buffer then tracks.
 */
export function substitutedGlyphs(
  face: GsubFace,
  codePoints: readonly number[],
  stages: readonly GsubStage[],
  clusters?: readonly number[]
): GsubBuffer {
  const buffer: GsubBuffer = {
    glyphs: codePoints.map((codePoint) => face.glyphIndex(codePoint)),
    randomState: 1,
    codePoints: [...codePoints],
    ...(clusters && { clusters: [...clusters] }),
  };
  if (face.gsub) applyGsub(face.gsub, stages, buffer, face.filter ?? null);
  return buffer;
}

function stagesOf(
  table: LayoutTable,
  scriptTags: readonly string[],
  feature: string | null,
  substitution: FeatureSubstitution | undefined
): GsubStage[] {
  const lookupsOf = (features: readonly string[]): number[] =>
    featureLookups(table, scriptTags, features, substitution);
  return [
    { lookups: lookupsOf(FIRST_STAGE_FEATURES), randomLookups: new Set() },
    { lookups: lookupsOf(shapingFeatures(scriptTags, feature)), randomLookups: new Set(lookupsOf(['rand'])) },
  ];
}

type StyleReader<T> = (
  table: LayoutTable,
  scriptTags: readonly string[],
  feature: string | null,
  substitution: FeatureSubstitution | undefined
) => T;

/** `read` built once for each table, `FeatureVariations` record, and each style's script tags and feature. */
function perStyle<T>(read: StyleReader<T>): StyleReader<T> {
  const byTable = perObject<LayoutTable, Map<FeatureSubstitution | undefined, Map<string, T>>>(
    () => new Map()
  );
  return (table, scriptTags, feature, substitution) => {
    const byRecord = byTable(table);
    let byStyle = byRecord.get(substitution);
    if (!byStyle) byRecord.set(substitution, (byStyle = new Map()));
    const key = JSON.stringify([scriptTags, feature]);
    const stored = byStyle.get(key);
    if (stored !== undefined) return stored;
    const value = read(table, scriptTags, feature, substitution);
    byStyle.set(key, value);
    return value;
  };
}

/** HarfBuzz's `GSUB` stages for text of `scriptTags` with `feature` on, under the lookups of `substitution`. */
export const gsubStages = perStyle(stagesOf);
const gposLookups = perStyle((table, scriptTags, feature, substitution) =>
  featureLookups(table, scriptTags, shapingFeatures(scriptTags, feature), substitution)
);

/** The y placement of a `GPOS` value record of `valueFormat` at `at`, 0 for a record without one. */
function yPlacementOf(dv: DataView, at: number, valueFormat: number): number {
  if (!(valueFormat & ValueFormat.Y_PLACEMENT)) return 0;
  return i16(dv, at + valueFieldOffset(valueFormat, ValueFormat.Y_PLACEMENT));
}

function adjust(glyph: ShapedGlyph, dv: DataView, at: number, valueFormat: number): void {
  glyph.yOffset += yPlacementOf(dv, at, valueFormat);
}

function applySinglePosition(dv: DataView, offset: number, glyph: ShapedGlyph): boolean {
  const index = coverageIndex(dv, offset + u16(dv, offset + 2), glyph.glyph);
  if (index < 0) return false;
  const valueFormat = u16(dv, offset + 4);
  const record = u16(dv, offset) === 1 ? 6 : 8 + index * valueRecordSize(valueFormat);
  adjust(glyph, dv, offset + record, valueFormat);
  return true;
}

function applyPairPosition(dv: DataView, offset: number, first: ShapedGlyph, second: ShapedGlyph): boolean {
  const records = pairValueRecords(dv, offset, first.glyph, second.glyph);
  if (!records) return false;
  adjust(first, dv, records[0].at, records[0].format);
  adjust(second, dv, records[1].at, records[1].format);
  return true;
}

function applyGpos(table: LayoutTable, lookups: readonly number[], shaped: ShapedGlyph[]): void {
  const { dv } = table;
  for (const lookupIndex of lookups) {
    for (let at = 0; at < shaped.length; at++) {
      for (const { type, offset } of table.lookups[lookupIndex]?.subtables ?? []) {
        const next = shaped[at + 1];
        const isApplied =
          type === GposType.SINGLE
            ? applySinglePosition(dv, offset, shaped[at]!)
            : type === GposType.PAIR && next
              ? applyPairPosition(dv, offset, shaped[at]!, next)
              : false;
        if (isApplied) break;
      }
    }
  }
}

/**
 * Shapes `cluster` with `feature` on, under the first of `scriptTags` the font has. A cluster of
 * digits alone is HarfBuzz's common script, which shapes under the default script.
 */
export function shapeCluster(
  face: ShapingFace,
  cluster: string,
  scriptTags: readonly string[],
  feature: string | null
): ShapedGlyph[] {
  const codePoints = [...cluster].map((character) => character.codePointAt(0)!);
  const tags = codePoints.every(isAsciiDigit) ? [] : scriptTags;
  const stages = face.gsub ? gsubStages(face.gsub, tags, feature, defaultSubstitution(face.gsub)) : [];
  const buffer = substitutedGlyphs(face, codePoints, stages);
  const shaped = buffer.glyphs.map((glyph): ShapedGlyph => ({ glyph, yOffset: 0 }));
  if (face.gpos)
    applyGpos(face.gpos, gposLookups(face.gpos, tags, feature, defaultSubstitution(face.gpos)), shaped);
  return shaped;
}

const isAsciiDigit = (codePoint: number): boolean => codePoint >= 0x30 && codePoint <= 0x39;
