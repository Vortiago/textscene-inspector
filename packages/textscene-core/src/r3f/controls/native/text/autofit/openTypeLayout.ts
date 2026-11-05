/**
 * The script, feature and lookup lists of a `GSUB` or `GPOS` table, the records their subtables
 * share, and HarfBuzz's `hb_ot_layout_collect_lookups`, which the auto-hinter calls to find the
 * lookups of a script and its features (`afshaper.c`).
 *
 * Portions ported from HarfBuzz ("Old MIT" licence).
 * Copyright (C) 2007-2026 by Behdad Esfahbod and the HarfBuzz contributors.
 * See THIRD-PARTY-NOTICES.md.
 */

import { readTag } from '../sfntTables';

/** A `LangSys` table: its required feature, or null for none, and its other features. */
interface LanguageSystem {
  readonly requiredFeature: number | null;
  readonly features: readonly number[];
}

interface Script {
  readonly tag: string;
  readonly defaultLanguage: LanguageSystem | null;
  readonly languages: readonly LanguageSystem[];
}

interface Feature {
  readonly tag: string;
  readonly lookups: readonly number[];
}

/** One subtable of a lookup, with an extension subtable (`GSUB` 7, `GPOS` 9) already followed. */
export interface Subtable {
  readonly type: number;
  readonly offset: number;
}

export interface Lookup {
  readonly subtables: readonly Subtable[];
  /** The lookup flag, as HarfBuzz keeps it in `lookup_props`: the mark filtering set in its high 16 bits. */
  readonly props: number;
}

/** The bits of a lookup flag (`LookupFlag`, `hb-ot-layout-common.hh`). */
export const LookupFlag = {
  IGNORE_BASE_GLYPHS: 0x2,
  IGNORE_LIGATURES: 0x4,
  IGNORE_MARKS: 0x8,
  /** A mark filtering set follows the subtable offsets. */
  USE_MARK_FILTERING_SET: 0x10,
  MARK_ATTACHMENT_TYPE: 0xff00,
} as const;

/**
 * A record of `FeatureVariations`: whether its conditions hold at the default instance, which
 * HarfBuzz shapes at with no coordinates set, and the alternate lookups of each feature it changes.
 */
interface FeatureSubstitution {
  readonly isDefaultInstance: boolean;
  readonly substitutions: ReadonlyMap<number, readonly number[]>;
}

/** `ConditionFormat1`, the axis range format; HarfBuzz holds a condition of another format false here. */
const CONDITION_AXIS_RANGE = 1;

export interface LayoutTable {
  readonly dv: DataView;
  /** The offset just past the table's bytes. */
  readonly end: number;
  readonly scripts: readonly Script[];
  readonly features: readonly Feature[];
  readonly lookups: readonly Lookup[];
  readonly featureSubstitutions: readonly FeatureSubstitution[];
}

const NO_REQUIRED_FEATURE = 0xffff;
const GSUB_EXTENSION = 7;
const GPOS_EXTENSION = 9;

/** The lookup types of `GSUB`. */
export const GsubType = {
  SINGLE: 1,
  MULTIPLE: 2,
  ALTERNATE: 3,
  LIGATURE: 4,
  CONTEXT: 5,
  CHAIN_CONTEXT: 6,
  REVERSE_CHAIN: 8,
} as const;
/** The lookup types of `GPOS`. */
export const GposType = {
  SINGLE: 1,
  PAIR: 2,
  CURSIVE: 3,
  MARK_TO_BASE: 4,
  MARK_TO_LIGATURE: 5,
  MARK_TO_MARK: 6,
  CONTEXT: 7,
  CHAIN_CONTEXT: 8,
} as const;

export const u16 = (dv: DataView, at: number): number => dv.getUint16(at, false);
export const i16 = (dv: DataView, at: number): number => dv.getInt16(at, false);

/** The `count` 16-bit values from `at`. */
function u16Values(dv: DataView, at: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => u16(dv, at + 2 * i));
}

/** The 16-bit values after the 16-bit count at `at`. */
export function countedU16Values(dv: DataView, at: number): number[] {
  return u16Values(dv, at + 2, u16(dv, at));
}

function readLanguageSystem(dv: DataView, at: number): LanguageSystem {
  const required = u16(dv, at + 2);
  return {
    requiredFeature: required === NO_REQUIRED_FEATURE ? null : required,
    features: countedU16Values(dv, at + 4),
  };
}

function readScripts(dv: DataView, list: number): Script[] {
  return Array.from({ length: u16(dv, list) }, (_, i) => {
    const record = list + 2 + 6 * i;
    const script = list + u16(dv, record + 4);
    const defaultOffset = u16(dv, script);
    const languages = Array.from({ length: u16(dv, script + 2) }, (_, j) =>
      readLanguageSystem(dv, script + u16(dv, script + 4 + 6 * j + 4))
    );
    return {
      tag: readTag(dv, record),
      defaultLanguage: defaultOffset === 0 ? null : readLanguageSystem(dv, script + defaultOffset),
      languages,
    };
  });
}

function readFeatures(dv: DataView, list: number): Feature[] {
  return Array.from({ length: u16(dv, list) }, (_, i) => {
    const record = list + 2 + 6 * i;
    return { tag: readTag(dv, record), lookups: countedU16Values(dv, list + u16(dv, record + 4) + 2) };
  });
}

function readLookups(dv: DataView, list: number, extensionType: number): Lookup[] {
  return Array.from({ length: u16(dv, list) }, (_, i) => {
    const lookup = list + u16(dv, list + 2 + 2 * i);
    const type = u16(dv, lookup);
    const flag = u16(dv, lookup + 2);
    const offsets = countedU16Values(dv, lookup + 4);
    const subtables = offsets.map((offset): Subtable => {
      const at = lookup + offset;
      if (type !== extensionType) return { type, offset: at };
      return { type: u16(dv, at + 2), offset: at + dv.getUint32(at + 4, false) };
    });
    // `Lookup::get_props` (`hb-ot-layout-common.hh:1325-1334`).
    const markFilteringSet =
      flag & LookupFlag.USE_MARK_FILTERING_SET ? u16(dv, lookup + 6 + 2 * offsets.length) : 0;
    return { subtables, props: flag + markFilteringSet * 0x10000 };
  });
}

function readFeatureSubstitutions(dv: DataView, table: number): FeatureSubstitution[] {
  const isVersionWithVariations = u16(dv, table) === 1 && u16(dv, table + 2) >= 1;
  const variationsOffset = isVersionWithVariations ? dv.getUint32(table + 10, false) : 0;
  if (variationsOffset === 0) return [];
  const variations = table + variationsOffset;
  return Array.from({ length: dv.getUint32(variations + 4, false) }, (_, i) => {
    const record = variations + 8 + 8 * i;
    const conditionSetOffset = dv.getUint32(record, false);
    const substitutionOffset = dv.getUint32(record + 4, false);
    return {
      isDefaultInstance: conditionSetOffset === 0 || holdsAtDefault(dv, variations + conditionSetOffset),
      substitutions:
        substitutionOffset === 0 ? new Map() : readSubstitutions(dv, variations + substitutionOffset),
    };
  });
}

/** Whether every condition of the `ConditionSet` at `at` holds at coordinate 0 on its axis. */
function holdsAtDefault(dv: DataView, at: number): boolean {
  for (let i = 0; i < u16(dv, at); i++) {
    const condition = at + dv.getUint32(at + 2 + 4 * i, false);
    if (u16(dv, condition) !== CONDITION_AXIS_RANGE) return false;
    if (dv.getInt16(condition + 4, false) > 0 || dv.getInt16(condition + 6, false) < 0) return false;
  }
  return true;
}

function readSubstitutions(dv: DataView, at: number): Map<number, readonly number[]> {
  const substitutions = new Map<number, readonly number[]>();
  for (let i = 0; i < u16(dv, at + 4); i++) {
    const record = at + 6 + 6 * i;
    substitutions.set(u16(dv, record), countedU16Values(dv, at + dv.getUint32(record + 2, false) + 2));
  }
  return substitutions;
}

/** Reads the `GSUB` or `GPOS` table of `length` bytes at `offset`. */
export function readLayoutTable(dv: DataView, offset: number, length: number, isGsub: boolean): LayoutTable {
  return {
    dv,
    end: offset + length,
    scripts: readScripts(dv, offset + u16(dv, offset + 4)),
    features: readFeatures(dv, offset + u16(dv, offset + 6)),
    lookups: readLookups(dv, offset + u16(dv, offset + 8), isGsub ? GSUB_EXTENSION : GPOS_EXTENSION),
    featureSubstitutions: readFeatureSubstitutions(dv, offset),
  };
}

/** HarfBuzz skips a script or language system with nothing in it (`hb_collect_features_context_t::visited`). */
const isEmptyScript = (script: Script): boolean => !script.defaultLanguage && script.languages.length === 0;
const isEmptyLanguage = (language: LanguageSystem): boolean =>
  language.requiredFeature === null && language.features.length === 0;

/**
 * `hb_ot_layout_collect_features` with every language: the features of the first script with
 * each of `scriptTags`, of the `featureTags` when they are not null. A filter leaves out the
 * required feature, as HarfBuzz does.
 */
function collectFeatures(
  table: LayoutTable,
  scriptTags: readonly string[],
  featureTags: readonly string[] | null
): Set<number> {
  const found = new Set<number>();
  const wanted =
    featureTags &&
    new Set(table.features.flatMap((feature, index) => (featureTags.includes(feature.tag) ? [index] : [])));
  const addLanguage = (language: LanguageSystem): void => {
    if (isEmptyLanguage(language)) return;
    if (!wanted) {
      if (language.requiredFeature !== null) found.add(language.requiredFeature);
      for (const feature of language.features) found.add(feature);
      return;
    }
    for (const feature of language.features) if (wanted.has(feature)) found.add(feature);
  };
  for (const tag of scriptTags) {
    const script = table.scripts.find((candidate) => candidate.tag === tag);
    if (!script || isEmptyScript(script)) continue;
    if (script.defaultLanguage) addLanguage(script.defaultLanguage);
    script.languages.forEach(addLanguage);
  }
  return found;
}

/**
 * `hb_ot_layout_collect_lookups` with every language: the lookups of the features of
 * `scriptTags`, and the alternates `FeatureVariations` gives those features, ascending.
 */
export function collectLookups(
  table: LayoutTable,
  scriptTags: readonly string[],
  featureTags: readonly string[] | null
): number[] {
  const features = collectFeatures(table, scriptTags, featureTags);
  const lookups = new Set<number>();
  for (const feature of features)
    for (const lookup of table.features[feature]?.lookups ?? []) lookups.add(lookup);
  for (const { substitutions } of table.featureSubstitutions)
    for (const [feature, alternate] of substitutions)
      if (features.has(feature)) alternate.forEach((lookup) => lookups.add(lookup));
  return [...lookups].sort((a, b) => a - b);
}

/** The glyphs of the coverage table at `at`, in coverage order. */
export function coverageGlyphs(dv: DataView, at: number): number[] {
  if (u16(dv, at) === 1) return countedU16Values(dv, at + 2);
  const glyphs: number[] = [];
  for (let i = 0; i < u16(dv, at + 2); i++) {
    const range = at + 4 + 6 * i;
    for (let glyph = u16(dv, range); glyph <= u16(dv, range + 2); glyph++) glyphs.push(glyph);
  }
  return glyphs;
}

/** The coverage index of `glyph` in the coverage table at `at`, or -1 for a glyph it does not cover. */
export function coverageIndex(dv: DataView, at: number, glyph: number): number {
  if (u16(dv, at) === 1) {
    const count = u16(dv, at + 2);
    for (let i = 0; i < count; i++) if (u16(dv, at + 4 + 2 * i) === glyph) return i;
    return -1;
  }
  for (let i = 0; i < u16(dv, at + 2); i++) {
    const range = at + 4 + 6 * i;
    const start = u16(dv, range);
    if (glyph >= start && glyph <= u16(dv, range + 2)) return u16(dv, range + 4) + glyph - start;
  }
  return -1;
}

/** Each glyph the class definition table at `at` lists, with its class. */
function classEntries(dv: DataView, at: number): [glyph: number, glyphClass: number][] {
  const entries: [number, number][] = [];
  if (u16(dv, at) === 1) {
    const start = u16(dv, at + 2);
    for (let i = 0; i < u16(dv, at + 4); i++) entries.push([start + i, u16(dv, at + 6 + 2 * i)]);
    return entries;
  }
  for (let i = 0; i < u16(dv, at + 2); i++) {
    const range = at + 4 + 6 * i;
    for (let glyph = u16(dv, range); glyph <= u16(dv, range + 2); glyph++)
      entries.push([glyph, u16(dv, range + 4)]);
  }
  return entries;
}

/** The class the class definition table at `at` gives `glyph`, 0 for a glyph it does not list. */
export function glyphClass(dv: DataView, at: number, glyph: number): number {
  if (u16(dv, at) === 1) {
    const index = glyph - u16(dv, at + 2);
    const count = u16(dv, at + 4);
    return index >= 0 && index < count ? u16(dv, at + 6 + 2 * index) : 0;
  }
  // The first range that holds the glyph gives its class, as a font's ranges can overlap.
  for (let i = 0; i < u16(dv, at + 2); i++) {
    const range = at + 4 + 6 * i;
    if (glyph >= u16(dv, range) && glyph <= u16(dv, range + 2)) return u16(dv, range + 4);
  }
  return 0;
}

/**
 * The glyphs of each class that the table at `at` lists (`ClassDef::collect_class`), in table
 * order. A class with no listed glyph has no entry.
 */
export function glyphsByClass(dv: DataView, at: number): Map<number, number[]> {
  const byClass = new Map<number, number[]>();
  for (const [glyph, value] of classEntries(dv, at)) {
    const glyphs = byClass.get(value);
    if (glyphs) glyphs.push(glyph);
    else byClass.set(value, [glyph]);
  }
  return byClass;
}

/** The glyphs of a class other than 0 (`ClassDef::collect_coverage`). */
export function classCoverage(dv: DataView, at: number): number[] {
  return classEntries(dv, at).flatMap(([glyph, value]) => (value !== 0 ? [glyph] : []));
}

/** A `SequenceLookupRecord`: the lookup to apply at an input position of a matched rule. */
export interface SequenceLookup {
  readonly sequenceIndex: number;
  readonly lookupIndex: number;
}

/**
 * A rule of a context or chained context subtable. Its values are glyphs, classes or coverage
 * offsets from the subtable, by the subtable's format, and `input` leaves out the first input.
 */
export interface ContextRule {
  /** The input count the font gives, 0 for a malformed rule. */
  readonly inputCount: number;
  readonly backtrack: readonly number[];
  readonly input: readonly number[];
  readonly lookahead: readonly number[];
  readonly records: readonly SequenceLookup[];
}

/** A rule of format 3, with the coverage offset of its first input, undefined in a rule of none. */
export interface CoverageContextRule extends ContextRule {
  readonly first: number;
}

function readSequenceLookups(dv: DataView, at: number, count: number): SequenceLookup[] {
  return Array.from({ length: count }, (_, i) => ({
    sequenceIndex: u16(dv, at + 4 * i),
    lookupIndex: u16(dv, at + 4 * i + 2),
  }));
}

/** The input after the first of a rule whose `inputCount` counts the first. */
function inputAfterFirst(dv: DataView, at: number, inputCount: number): number[] {
  // Guarded as HarfBuzz guards it (`inputCount ? inputCount - 1 : 0`): a count of 0 is malformed.
  return u16Values(dv, at, Math.max(inputCount - 1, 0));
}

/** A `SequenceRule` of a context subtable of format 1 or 2. */
export function readSequenceRule(dv: DataView, at: number): ContextRule {
  const inputCount = u16(dv, at);
  const input = inputAfterFirst(dv, at + 4, inputCount);
  return {
    inputCount,
    backtrack: [],
    input,
    lookahead: [],
    records: readSequenceLookups(dv, at + 4 + 2 * input.length, u16(dv, at + 2)),
  };
}

/** A `ChainedSequenceRule` of a chained context subtable of format 1 or 2. */
export function readChainedSequenceRule(dv: DataView, at: number): ContextRule {
  const backtrack = countedU16Values(dv, at);
  const inputAt = at + 2 + 2 * backtrack.length;
  const inputCount = u16(dv, inputAt);
  const input = inputAfterFirst(dv, inputAt + 2, inputCount);
  const lookaheadAt = inputAt + 2 + 2 * input.length;
  const lookahead = countedU16Values(dv, lookaheadAt);
  const recordsAt = lookaheadAt + 2 + 2 * lookahead.length;
  const records = readSequenceLookups(dv, recordsAt + 2, u16(dv, recordsAt));
  return { inputCount, backtrack, input, lookahead, records };
}

/** The single rule of a context subtable of format 3 at `subtable`. */
export function readSequenceContextFormat3(dv: DataView, subtable: number): CoverageContextRule {
  const inputCount = u16(dv, subtable + 2);
  const coverages = u16Values(dv, subtable + 6, inputCount);
  return {
    inputCount,
    first: coverages[0]!,
    backtrack: [],
    input: coverages.slice(1),
    lookahead: [],
    records: readSequenceLookups(dv, subtable + 6 + 2 * inputCount, u16(dv, subtable + 4)),
  };
}

/** The single rule of a chained context subtable of format 3 at `subtable`. */
export function readChainedSequenceContextFormat3(dv: DataView, subtable: number): CoverageContextRule {
  const backtrack = countedU16Values(dv, subtable + 2);
  const inputAt = subtable + 4 + 2 * backtrack.length;
  const coverages = countedU16Values(dv, inputAt);
  const lookaheadAt = inputAt + 2 + 2 * coverages.length;
  const lookahead = countedU16Values(dv, lookaheadAt);
  const recordsAt = lookaheadAt + 2 + 2 * lookahead.length;
  return {
    inputCount: coverages.length,
    first: coverages[0]!,
    backtrack,
    input: coverages.slice(1),
    lookahead,
    records: readSequenceLookups(dv, recordsAt + 2, u16(dv, recordsAt)),
  };
}

/**
 * The size in bytes of a `GPOS` value record of `valueFormat`: two bytes for each bit set, the
 * reserved bits too, as HarfBuzz counts them (`ValueFormat::get_len`).
 */
export function valueRecordSize(valueFormat: number): number {
  let size = 0;
  for (let bits = valueFormat; bits !== 0; bits &= bits - 1) size += 2;
  return size;
}

/**
 * One value record of a `GPOS` pair subtable: where it starts, its format, and the table its device
 * offsets count from, a `PairSet` in format 1 and the subtable in format 2.
 */
export interface PairValueRecord {
  readonly at: number;
  readonly base: number;
  readonly format: number;
}

/** The first value record of the pair set at `pairSet` for `right`, or null for a glyph it does not list. */
function pairSetRecord(dv: DataView, pairSet: number, right: number, recordSize: number): number | null {
  const count = u16(dv, pairSet);
  for (let i = 0; i < count; i++) {
    const record = pairSet + 2 + i * (2 + recordSize);
    if (u16(dv, record) === right) return record + 2;
  }
  return null;
}

/**
 * The two value records the pair subtable at `subtable` gives `left` and `right` (`PairPosFormat1`,
 * `PairPosFormat2`), or null for a pair it does not hold.
 */
export function pairValueRecords(
  dv: DataView,
  subtable: number,
  left: number,
  right: number
): [PairValueRecord, PairValueRecord] | null {
  const leftIndex = coverageIndex(dv, subtable + u16(dv, subtable + 2), left);
  if (leftIndex < 0) return null;
  const format1 = u16(dv, subtable + 4);
  const format2 = u16(dv, subtable + 6);
  const size1 = valueRecordSize(format1);
  const recordSize = size1 + valueRecordSize(format2);
  let at: number | null;
  let base = subtable;
  if (u16(dv, subtable) === 1) {
    base = subtable + u16(dv, subtable + 10 + 2 * leftIndex);
    at = pairSetRecord(dv, base, right, recordSize);
  } else {
    const leftClass = glyphClass(dv, subtable + u16(dv, subtable + 8), left);
    const rightClass = glyphClass(dv, subtable + u16(dv, subtable + 10), right);
    const rightClassCount = u16(dv, subtable + 14);
    at =
      leftClass < u16(dv, subtable + 12) && rightClass < rightClassCount
        ? subtable + 16 + (leftClass * rightClassCount + rightClass) * recordSize
        : null;
  }
  if (at === null) return null;
  return [
    { at, base, format: format1 },
    { at: at + size1, base, format: format2 },
  ];
}

/**
 * The substitute that the single substitution subtable at `subtable` gives `glyph`, at coverage
 * index `index`: the glyph plus the delta modulo 0x10000 in format 1, or entry `index` in format 2.
 */
export function singleSubstitute(dv: DataView, subtable: number, glyph: number, index: number): number {
  if (u16(dv, subtable) === 1) return (glyph + u16(dv, subtable + 4)) & 0xffff;
  return u16(dv, subtable + 6 + 2 * index);
}

/**
 * The glyphs that a multiple or alternate substitution subtable at `subtable` lists for coverage
 * index `index`: its `Sequence` or its `AlternateSet`.
 */
export function substituteList(dv: DataView, subtable: number, index: number): number[] {
  return countedU16Values(dv, subtable + u16(dv, subtable + 6 + 2 * index));
}
