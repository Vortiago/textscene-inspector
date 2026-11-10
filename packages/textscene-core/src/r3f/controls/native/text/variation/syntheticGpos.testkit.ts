/**
 * A variable font of `fvar`, `GPOS` and `GDEF` alone, built in bytes, so a test sets each field of a
 * `kern` lookup that the fixture fonts leave out: its lookup flag, its mark filtering set, the
 * device table of its value and the language system that holds it. Each lookup kerns glyph 1 before glyph 2 by `KERNED_UNITS`.
 */

import { GposType, ValueFormat } from '../autofit/openTypeLayout';
import { FIXED_16_16_ONE } from '../fontMetrics';
import { ByteWriter } from '../sfntOutlines.testkit';
import { sfntFileOfTables, type SfntFile } from '../sfntTables';

export const KERNED_UNITS = -50;
const LEFT_GLYPH = 1;
const RIGHT_GLYPH = 2;

/** The offset of each of `parts` laid end to end from `start`. */
function offsetsOf(parts: readonly ByteWriter[], start: number): number[] {
  let at = start;
  return parts.map((part) => {
    const offset = at;
    at += part.length;
    return offset;
  });
}

/** An `fvar` with one `wght` axis from 100 to 900, its default 400. */
function fvarBytes(): ByteWriter {
  const out = new ByteWriter().u32(0x00010000).u16(16).u16(2).u16(1).u16(20).u16(0).u16(8);
  return out
    .tag('wght')
    .u32(100 << 16)
    .u32(400 << 16)
    .u32(900 << 16)
    .u16(0)
    .u16(256);
}

/** A `HintingDevice` of format 1 that moves every ppem from `start` to `end` by `pixels`, from -2 to 1. */
interface HintingDevice {
  readonly start: number;
  readonly end: number;
  readonly pixels: number;
}

export interface KernLookup {
  /** The lookup flag, with `UseMarkFilteringSet` set where `markFilteringSet` names a set. */
  readonly flag: number;
  readonly markFilteringSet?: number;
  readonly device?: HintingDevice;
  /** The feature that holds the lookup: `kern` of the default language system where it gives none. */
  readonly feature?: KernFeature;
}

/**
 * The features of the synthetic `GPOS`, in feature list order: `kern`, `dist` and a required feature
 * tagged `test` in the default language system, and a `kern` of its own in the `TRK ` system.
 */
const FEATURES = [
  { name: 'kern', tag: 'kern' },
  { name: 'dist', tag: 'dist' },
  { name: 'required', tag: 'test' },
  { name: 'languageKern', tag: 'kern' },
] as const;
type KernFeature = (typeof FEATURES)[number]['name'];
const featureIndex = (name: KernFeature): number => FEATURES.findIndex((feature) => feature.name === name);

/** The format 1 device table of `device`: two bits for each ppem, eight to a word. */
function deviceBytes({ start, end, pixels }: HintingDevice): ByteWriter {
  const out = new ByteWriter().u16(start).u16(end).u16(1);
  const count = end - start + 1;
  for (let word = 0; word * 8 < count; word++) {
    let bits = 0;
    for (let i = 0; i < 8; i++) bits = (bits << 2) | (word * 8 + i < count ? pixels & 0x3 : 0);
    out.u16(bits);
  }
  return out;
}

/** A `PairPosFormat1` subtable that kerns the pair, with `device` on the advance. */
function pairPosBytes({ device }: KernLookup): ByteWriter {
  const header = 12;
  const coverage = new ByteWriter().u16(1).u16(1).u16(LEFT_GLYPH);
  const pairSet = new ByteWriter()
    .u16(1)
    .u16(RIGHT_GLYPH)
    .u16(KERNED_UNITS & 0xffff);
  // A format 1 device offset counts from the `PairSet`, and the device follows the coverage.
  if (device) pairSet.u16(pairSet.length + 2 + coverage.length);
  const valueFormat = ValueFormat.X_ADVANCE | (device ? ValueFormat.X_ADVANCE_DEVICE : 0);
  return new ByteWriter()
    .u16(1)
    .u16(header + pairSet.length)
    .u16(valueFormat)
    .u16(0)
    .u16(1)
    .u16(header)
    .raw(pairSet)
    .raw(coverage)
    .raw(device ? deviceBytes(device) : []);
}

/** A `Lookup` of type 2 with one pair subtable. */
function lookupBytes(lookup: KernLookup): ByteWriter {
  const hasMarkFilteringSet = lookup.markFilteringSet !== undefined;
  const out = new ByteWriter()
    .u16(GposType.PAIR)
    .u16(lookup.flag)
    .u16(1)
    .u16(hasMarkFilteringSet ? 10 : 8);
  if (hasMarkFilteringSet) out.u16(lookup.markFilteringSet!);
  return out.raw(pairPosBytes(lookup));
}

/** A `LangSys` with `requiredFeature` (0xffff for none) and `features`. */
function langSysBytes(requiredFeature: number, features: readonly number[]): ByteWriter {
  const out = new ByteWriter().u16(0).u16(requiredFeature).u16(features.length);
  features.forEach((index) => out.u16(index));
  return out;
}

/** A `ScriptList` whose `DFLT` script holds the features of `FEATURES` in its two language systems. */
function scriptListBytes(): ByteWriter {
  const scriptHeader = 10;
  const defaultFeatures = [featureIndex('kern'), featureIndex('dist')];
  const defaultLangSys = langSysBytes(featureIndex('required'), defaultFeatures);
  const script = new ByteWriter()
    .u16(scriptHeader)
    .u16(1)
    .tag('TRK ')
    .u16(scriptHeader + defaultLangSys.length);
  script.raw(defaultLangSys).raw(langSysBytes(0xffff, [featureIndex('languageKern')]));
  return new ByteWriter().u16(1).tag('DFLT').u16(8).raw(script);
}

/** The `FeatureList` of `FEATURES`, each holding the indices of the lookups that name it. */
function featureListBytes(lookups: readonly KernLookup[]): ByteWriter {
  const tables = FEATURES.map(({ name }) => {
    const indices = lookups.flatMap((lookup, index) => ((lookup.feature ?? 'kern') === name ? [index] : []));
    const table = new ByteWriter().u16(0).u16(indices.length);
    indices.forEach((index) => table.u16(index));
    return table;
  });
  const out = new ByteWriter().u16(tables.length);
  offsetsOf(tables, 2 + 6 * tables.length).forEach((offset, i) => out.tag(FEATURES[i]!.tag).u16(offset));
  tables.forEach((table) => out.raw(table));
  return out;
}

/** A `GPOS` whose `DFLT` script holds `lookups`, in order, each in its feature. */
function gposBytes(lookups: readonly KernLookup[]): ByteWriter {
  const scriptList = scriptListBytes();
  const featureList = featureListBytes(lookups);
  const lookupTables = lookups.map(lookupBytes);
  const lookupList = new ByteWriter().u16(lookups.length);
  offsetsOf(lookupTables, 2 + 2 * lookups.length).forEach((offset) => lookupList.u16(offset));
  lookupTables.forEach((table) => lookupList.raw(table));
  const header = 10;
  return new ByteWriter()
    .u32(0x00010000)
    .u16(header)
    .u16(header + scriptList.length)
    .u16(header + scriptList.length + featureList.length)
    .raw(scriptList)
    .raw(featureList)
    .raw(lookupList);
}

/** A `ClassDef` of format 2 that gives each glyph its class. */
function classDefBytes(classes: ReadonlyMap<number, number>): ByteWriter {
  const sorted = [...classes].sort(([a], [b]) => a - b);
  const out = new ByteWriter().u16(2).u16(sorted.length);
  for (const [glyph, glyphClass] of sorted) out.u16(glyph).u16(glyph).u16(glyphClass);
  return out;
}

/** The `MarkGlyphSets` table of `sets`, each a format 1 coverage. */
function markGlyphSetsBytes(sets: readonly (readonly number[])[]): ByteWriter {
  const coverages = sets.map((glyphs) => {
    const coverage = new ByteWriter().u16(1).u16(glyphs.length);
    [...glyphs].sort((a, b) => a - b).forEach((glyph) => coverage.u16(glyph));
    return coverage;
  });
  const out = new ByteWriter().u16(1).u16(coverages.length);
  offsetsOf(coverages, 4 + 4 * coverages.length).forEach((offset) => out.u32(offset));
  coverages.forEach((coverage) => out.raw(coverage));
  return out;
}

export interface GlyphDefinitions {
  /** `GDEF` glyph classes: 1 base, 2 ligature, 3 mark, 4 component. */
  readonly glyphClasses?: ReadonlyMap<number, number>;
  readonly markAttachClasses?: ReadonlyMap<number, number>;
  /** The glyphs of each mark glyph set, in set order. */
  readonly markGlyphSets?: readonly (readonly number[])[];
}

/** The size of a `GDEF` 1.2 header: the version and five offsets. */
const GDEF_1_2_HEADER_SIZE = 14;

/** A `GDEF` 1.2 with the glyph classes, the mark attachment classes and the mark glyph sets of `definitions`. */
function gdefBytes({ glyphClasses, markAttachClasses, markGlyphSets }: GlyphDefinitions): ByteWriter {
  const parts = [
    glyphClasses && classDefBytes(glyphClasses),
    markAttachClasses && classDefBytes(markAttachClasses),
    markGlyphSets && markGlyphSetsBytes(markGlyphSets),
  ];
  const present = parts.filter((part): part is ByteWriter => part !== undefined);
  const offsets = offsetsOf(present, GDEF_1_2_HEADER_SIZE);
  const [glyphClassDef, markAttachClassDef, markGlyphSetsDef] = parts.map((part) =>
    part ? offsets[present.indexOf(part)]! : 0
  );
  const out = new ByteWriter().u16(1).u16(2).u16(glyphClassDef!).u16(0).u16(0);
  out.u16(markAttachClassDef!).u16(markGlyphSetsDef!);
  present.forEach((part) => out.raw(part));
  return out;
}

const tableBytes = (out: ByteWriter): Uint8Array => new Uint8Array(out.toBytes());

/** A variable font whose `kern` feature holds `lookups`, with `GDEF` where `definitions` gives one. */
export function syntheticKernFont(lookups: readonly KernLookup[], definitions?: GlyphDefinitions): SfntFile {
  const tables = new Map([
    ['fvar', tableBytes(fvarBytes())],
    ['GPOS', tableBytes(gposBytes(lookups))],
  ]);
  if (definitions) tables.set('GDEF', tableBytes(gdefBytes(definitions)));
  return sfntFileOfTables(tables);
}

/** `wght` at 700, in the 16.16 normalised coordinates of the font: (700 - 400) / (900 - 400). */
export const BOLD_NORMALIZED = Int32Array.of(Math.round(0.6 * FIXED_16_16_ONE));
