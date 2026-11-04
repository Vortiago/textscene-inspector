/**
 * The script, feature and lookup lists of a `GSUB` or `GPOS` table, with the coverage and class
 * tables their subtables share, and HarfBuzz's `hb_ot_layout_collect_lookups`, which the
 * auto-hinter calls to find the lookups of a script and its features (`afshaper.c`).
 *
 * Portions ported from HarfBuzz (MIT).
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
}

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

const u16 = (dv: DataView, at: number): number => dv.getUint16(at, false);

/** The `count` 16-bit values after the count at `at`. */
function u16Array(dv: DataView, at: number): number[] {
  return Array.from({ length: u16(dv, at) }, (_, i) => u16(dv, at + 2 + 2 * i));
}

function readLanguageSystem(dv: DataView, at: number): LanguageSystem {
  const required = u16(dv, at + 2);
  return {
    requiredFeature: required === NO_REQUIRED_FEATURE ? null : required,
    features: u16Array(dv, at + 4),
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
    return { tag: readTag(dv, record), lookups: u16Array(dv, list + u16(dv, record + 4) + 2) };
  });
}

function readLookups(dv: DataView, list: number, extensionType: number): Lookup[] {
  return Array.from({ length: u16(dv, list) }, (_, i) => {
    const lookup = list + u16(dv, list + 2 + 2 * i);
    const type = u16(dv, lookup);
    const subtables = u16Array(dv, lookup + 4).map((offset): Subtable => {
      const at = lookup + offset;
      if (type !== extensionType) return { type, offset: at };
      return { type: u16(dv, at + 2), offset: at + dv.getUint32(at + 4, false) };
    });
    return { subtables };
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
    substitutions.set(u16(dv, record), u16Array(dv, at + dv.getUint32(record + 2, false) + 2));
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
  if (u16(dv, at) === 1) return u16Array(dv, at + 2);
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
  return classEntries(dv, at).find(([listed]) => listed === glyph)?.[1] ?? 0;
}

/** The glyphs of class `glyphClassValue` that the table at `at` lists (`ClassDef::collect_class`). */
export function classGlyphs(dv: DataView, at: number, glyphClassValue: number): number[] {
  return classEntries(dv, at).flatMap(([glyph, value]) => (value === glyphClassValue ? [glyph] : []));
}

/** The glyphs of a class other than 0 (`ClassDef::collect_coverage`). */
export function classCoverage(dv: DataView, at: number): number[] {
  return classEntries(dv, at).flatMap(([glyph, value]) => (value !== 0 ? [glyph] : []));
}
