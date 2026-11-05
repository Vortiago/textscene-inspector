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
import {
  type ContextRule,
  type CoverageContextRule,
  coverageIndex,
  DEFAULT_FEATURES,
  glyphClass,
  GposType,
  GsubType,
  i16,
  languageFeatures,
  type LayoutTable,
  pairValueRecords,
  readChainedSequenceContextFormat3,
  readChainedSequenceRule,
  readSequenceContextFormat3,
  readSequenceRule,
  singleSubstitute,
  substituteList,
  type Subtable,
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

export interface ShapingFace {
  glyphIndex(codePoint: number): number;
  readonly gsub: LayoutTable | null;
  readonly gpos: LayoutTable | null;
}

/** HarfBuzz's feature of the default shaper before `rvrn`'s pause (`hb-ot-shape.cc:329-376`). */
const FIRST_STAGE_FEATURES = ['rvrn'] as const;

/** The scripts of the auto-hinter that HarfBuzz sets right to left (`hb_script_get_horizontal_direction`). */
const RIGHT_TO_LEFT_SCRIPT_TAGS: ReadonlySet<string> = new Set([
  'adlm',
  'arab',
  'avst',
  'cprt',
  'hebr',
  'nko ',
  'rohg',
]);

/** The features after `rvrn`'s pause for text of `scriptTags`, with `feature` on. */
function shapingFeatures(scriptTags: readonly string[], feature: string | null): string[] {
  const isRightToLeft = scriptTags.some((tag) => RIGHT_TO_LEFT_SCRIPT_TAGS.has(tag));
  const directionFeatures = isRightToLeft ? ['rtla', 'rtlm'] : ['ltra', 'ltrm'];
  return [...directionFeatures, ...DEFAULT_FEATURES, ...(feature ? [feature] : [])];
}

/** The default script HarfBuzz falls back on, then the two it tries after it (`hb_ot_layout_table_select_script`). */
const FALLBACK_SCRIPT_TAGS = ['DFLT', 'dflt', 'latn'] as const;

/** The lookups of `features` under the first script of `scriptTags` the table has, its default language. */
function featureLookups(
  table: LayoutTable,
  scriptTags: readonly string[],
  features: readonly string[]
): number[] {
  const script = [...scriptTags, ...FALLBACK_SCRIPT_TAGS]
    .map((tag) => table.scripts.find((candidate) => candidate.tag === tag))
    .find((found) => found !== undefined);
  const language = script?.defaultLanguage;
  if (!language) return [];
  const indices = languageFeatures(table, language, features);
  const substitutions = table.featureSubstitutions.find(
    (variation) => variation.isDefaultInstance
  )?.substitutions;
  const lookupsOf = (index: number): readonly number[] =>
    substitutions?.get(index) ?? table.features[index]?.lookups ?? [];
  const lookups = new Set(indices.flatMap(lookupsOf));
  return [...lookups].sort((a, b) => a - b);
}

/** One stage of lookups, applied in index order, and those of them that `rand` holds. */
interface Stage {
  lookups: readonly number[];
  randomLookups: ReadonlySet<number>;
}

function stagesOf(table: LayoutTable, scriptTags: readonly string[], feature: string | null): Stage[] {
  const random = new Set(featureLookups(table, scriptTags, ['rand']));
  return [
    { lookups: featureLookups(table, scriptTags, FIRST_STAGE_FEATURES), randomLookups: new Set() },
    {
      lookups: featureLookups(table, scriptTags, shapingFeatures(scriptTags, feature)),
      randomLookups: random,
    },
  ];
}

type StyleReader<T> = (table: LayoutTable, scriptTags: readonly string[], feature: string | null) => T;

/** `read` built once for each table and each style's script tags and feature. */
function perStyle<T>(read: StyleReader<T>): StyleReader<T> {
  const byTable = perObject<LayoutTable, Map<string, T>>(() => new Map());
  return (table, scriptTags, feature) => {
    const byStyle = byTable(table);
    const key = JSON.stringify([scriptTags, feature]);
    const stored = byStyle.get(key);
    if (stored !== undefined) return stored;
    const value = read(table, scriptTags, feature);
    byStyle.set(key, value);
    return value;
  };
}

const gsubStages = perStyle(stagesOf);
const gposLookups = perStyle((table, scriptTags, feature) =>
  featureLookups(table, scriptTags, shapingFeatures(scriptTags, feature))
);

/** The shaping buffer: its glyphs, and the state of `rand`'s random number generator (`hb_buffer_t`). */
interface Buffer {
  glyphs: number[];
  randomState: number;
}

/** HarfBuzz's random alternate: a Lehmer generator seeded with 1 (`hb_ot_apply_context_t::random_number`). */
function nextRandom(buffer: Buffer): number {
  buffer.randomState = (buffer.randomState * 48271) % 2147483647;
  return buffer.randomState;
}

/** The substitute of an alternate set: the first, or a random one for `rand`. */
function alternateOf(alternates: readonly number[], buffer: Buffer, isRandom: boolean): number {
  const index = isRandom ? nextRandom(buffer) % alternates.length : 0;
  return alternates[index]!;
}

interface Applied {
  /** The position after the glyphs the subtable consumed or put out. */
  next: number;
}

function applySingle(dv: DataView, offset: number, buffer: Buffer, at: number): Applied | null {
  const glyph = buffer.glyphs[at]!;
  const index = coverageIndex(dv, offset + u16(dv, offset + 2), glyph);
  if (index < 0) return null;
  buffer.glyphs[at] = singleSubstitute(dv, offset, glyph, index);
  return { next: at + 1 };
}

function applyMultiple(dv: DataView, offset: number, buffer: Buffer, at: number): Applied | null {
  const index = coverageIndex(dv, offset + u16(dv, offset + 2), buffer.glyphs[at]!);
  if (index < 0) return null;
  const sequence = substituteList(dv, offset, index);
  buffer.glyphs.splice(at, 1, ...sequence);
  return { next: at + sequence.length };
}

function applyAlternate(
  dv: DataView,
  offset: number,
  buffer: Buffer,
  at: number,
  isRandom: boolean
): Applied | null {
  const index = coverageIndex(dv, offset + u16(dv, offset + 2), buffer.glyphs[at]!);
  if (index < 0) return null;
  const alternates = substituteList(dv, offset, index);
  if (alternates.length === 0) return null;
  buffer.glyphs[at] = alternateOf(alternates, buffer, isRandom);
  return { next: at + 1 };
}

function applyLigature(dv: DataView, offset: number, buffer: Buffer, at: number): Applied | null {
  const index = coverageIndex(dv, offset + u16(dv, offset + 2), buffer.glyphs[at]!);
  if (index < 0) return null;
  const set = offset + u16(dv, offset + 6 + 2 * index);
  for (let i = 0; i < u16(dv, set); i++) {
    const ligature = set + u16(dv, set + 2 + 2 * i);
    const componentCount = u16(dv, ligature + 2);
    // A ligature of no components would insert its glyph and never consume one (`Ligature::apply`).
    if (componentCount === 0 || at + componentCount > buffer.glyphs.length) continue;
    let isMatch = true;
    for (let c = 1; c < componentCount && isMatch; c++)
      isMatch = buffer.glyphs[at + c] === u16(dv, ligature + 4 + 2 * (c - 1));
    if (!isMatch) continue;
    buffer.glyphs.splice(at, componentCount, u16(dv, ligature));
    return { next: at + 1 };
  }
  return null;
}

/** How the values of a context rule match a glyph: as a glyph, a class, or a coverage offset. */
type Matcher = (glyph: number, value: number) => boolean;

/** Whether the rule's backtrack, input after the first glyph, and lookahead match around `at`. */
function ruleMatches(
  glyphs: readonly number[],
  at: number,
  rule: ContextRule,
  matchers: readonly [Matcher, Matcher, Matcher]
): boolean {
  const [matchBacktrack, matchInput, matchLookahead] = matchers;
  if (at < rule.backtrack.length || at + 1 + rule.input.length + rule.lookahead.length > glyphs.length)
    return false;
  return (
    rule.backtrack.every((value, i) => matchBacktrack(glyphs[at - 1 - i]!, value)) &&
    rule.input.every((value, i) => matchInput(glyphs[at + 1 + i]!, value)) &&
    rule.lookahead.every((value, i) => matchLookahead(glyphs[at + 1 + rule.input.length + i]!, value))
  );
}

/** The rule of a context subtable that matches at `at`, with how its values match. */
function matchingRule(
  dv: DataView,
  offset: number,
  glyphs: readonly number[],
  at: number,
  isChain: boolean
): ContextRule | null {
  const format = u16(dv, offset);
  const byGlyph: Matcher = (glyph, value) => glyph === value;
  const byCoverage: Matcher = (glyph, value) => coverageIndex(dv, offset + value, glyph) >= 0;
  if (format === 3) {
    const rule: CoverageContextRule = isChain
      ? readChainedSequenceContextFormat3(dv, offset)
      : readSequenceContextFormat3(dv, offset);
    if (coverageIndex(dv, offset + rule.first, glyphs[at]!) < 0) return null;
    return ruleMatches(glyphs, at, rule, [byCoverage, byCoverage, byCoverage]) ? rule : null;
  }
  const coverage = coverageIndex(dv, offset + u16(dv, offset + 2), glyphs[at]!);
  if (coverage < 0) return null;
  const classDefs =
    format === 2 ? (isChain ? [4, 6, 8] : [4, 4, 4]).map((field) => offset + u16(dv, offset + field)) : null;
  const byClass =
    (classDef: number): Matcher =>
    (glyph, value) =>
      glyphClass(dv, classDef, glyph) === value;
  const matchers: [Matcher, Matcher, Matcher] = classDefs
    ? [byClass(classDefs[0]!), byClass(classDefs[1]!), byClass(classDefs[2]!)]
    : [byGlyph, byGlyph, byGlyph];
  const setIndex = classDefs ? glyphClass(dv, classDefs[1]!, glyphs[at]!) : coverage;
  const countAt = offset + (format === 1 ? 4 : isChain ? 10 : 6);
  if (setIndex >= u16(dv, countAt)) return null;
  const setOffset = u16(dv, countAt + 2 + 2 * setIndex);
  if (setOffset === 0) return null;
  const set = offset + setOffset;
  const readRule = isChain ? readChainedSequenceRule : readSequenceRule;
  for (let i = 0; i < u16(dv, set); i++) {
    const rule = readRule(dv, set + u16(dv, set + 2 + 2 * i));
    if (ruleMatches(glyphs, at, rule, matchers)) return rule;
  }
  return null;
}

/** The deepest nesting of context lookups HarfBuzz follows (`HB_MAX_NESTING_LEVEL`). */
const MAX_NESTING = 64;

function applyContext(
  table: LayoutTable,
  subtable: Subtable,
  buffer: Buffer,
  at: number,
  depth: number
): Applied | null {
  const rule = matchingRule(
    table.dv,
    subtable.offset,
    buffer.glyphs,
    at,
    subtable.type === GsubType.CHAIN_CONTEXT
  );
  if (!rule) return null;
  let end = at + 1 + rule.input.length;
  for (const { sequenceIndex, lookupIndex } of rule.records) {
    if (depth >= MAX_NESTING || sequenceIndex >= end - at) continue;
    const lengthBefore = buffer.glyphs.length;
    applyLookupAt(table, lookupIndex, buffer, at + sequenceIndex, false, depth + 1);
    end += buffer.glyphs.length - lengthBefore;
  }
  return { next: end };
}

function applySubtable(
  table: LayoutTable,
  subtable: Subtable,
  buffer: Buffer,
  at: number,
  isRandom: boolean,
  depth: number
): Applied | null {
  const { dv } = table;
  switch (subtable.type) {
    case GsubType.SINGLE:
      return applySingle(dv, subtable.offset, buffer, at);
    case GsubType.MULTIPLE:
      return applyMultiple(dv, subtable.offset, buffer, at);
    case GsubType.ALTERNATE:
      return applyAlternate(dv, subtable.offset, buffer, at, isRandom);
    case GsubType.LIGATURE:
      return applyLigature(dv, subtable.offset, buffer, at);
    case GsubType.CONTEXT:
    case GsubType.CHAIN_CONTEXT:
      return applyContext(table, subtable, buffer, at, depth);
    default:
      return null;
  }
}

/** Applies the first subtable of a lookup that applies at `at`, as a nested lookup does. */
function applyLookupAt(
  table: LayoutTable,
  lookupIndex: number,
  buffer: Buffer,
  at: number,
  isRandom: boolean,
  depth: number
): Applied | null {
  for (const subtable of table.lookups[lookupIndex]?.subtables ?? []) {
    const applied = applySubtable(table, subtable, buffer, at, isRandom, depth);
    if (applied) return applied;
  }
  return null;
}

function applyGsub(table: LayoutTable, stages: readonly Stage[], buffer: Buffer): void {
  for (const { lookups, randomLookups } of stages) {
    for (const lookupIndex of lookups) {
      for (let at = 0; at < buffer.glyphs.length;) {
        const applied = applyLookupAt(table, lookupIndex, buffer, at, randomLookups.has(lookupIndex), 0);
        // A deletion leaves `next` at `at`, on the glyph after the deleted one, which the lookup
        // still visits. A subtable that does not advance shrinks the buffer, so the loop ends.
        at = applied ? Math.max(applied.next, at) : at + 1;
      }
    }
  }
}

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
  const buffer: Buffer = {
    glyphs: codePoints.map((codePoint) => face.glyphIndex(codePoint)),
    randomState: 1,
  };
  if (face.gsub) applyGsub(face.gsub, gsubStages(face.gsub, tags, feature), buffer);
  const shaped = buffer.glyphs.map((glyph): ShapedGlyph => ({ glyph, yOffset: 0 }));
  if (face.gpos) applyGpos(face.gpos, gposLookups(face.gpos, tags, feature), shaped);
  return shaped;
}

const isAsciiDigit = (codePoint: number): boolean => codePoint >= 0x30 && codePoint <= 0x39;
