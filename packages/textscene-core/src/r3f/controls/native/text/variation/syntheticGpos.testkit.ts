/**
 * A variable font of `fvar`, `GPOS` and `GDEF` alone, built in bytes, so a test sets each field of a
 * `kern` lookup that the fixture fonts leave out: its lookup flag, its mark filtering set and the
 * device table of its value.
 */

import { sfntFileOfTables, type SfntFile } from '../sfntTables';

/** Big-endian 16-bit words, written as a table lays them out. */
const words = (...values: number[]): number[] =>
  values.flatMap((value) => [(value >> 8) & 0xff, value & 0xff]);
const tagBytes = (tag: string): number[] => [...tag].map((ch) => ch.charCodeAt(0));
const fixed = (value: number): number[] => words((value >> 16) & 0xffff, value & 0xffff);

const WGHT = 'wght';
const VALUE_X_ADVANCE = 0x4;
const VALUE_X_ADVANCE_DEVICE = 0x40;

/** An `fvar` with one `wght` axis from 100 to 900, its default 400. */
function fvarBytes(): Uint8Array {
  const header = [...words(1, 0), ...words(16, 2, 1, 20, 0, 8)];
  const axis = [
    ...tagBytes(WGHT),
    ...fixed(100 << 16),
    ...fixed(400 << 16),
    ...fixed(900 << 16),
    ...words(0, 256),
  ];
  return new Uint8Array([...header, ...axis]);
}

/** A `HintingDevice` of format 1 that moves every ppem from `start` to `end` by `pixels`, from -2 to 1. */
export interface HintingDevice {
  readonly start: number;
  readonly end: number;
  readonly pixels: number;
}

export interface KernLookup {
  /** The lookup flag, with `UseMarkFilteringSet` set where `markFilteringSet` names a set. */
  readonly flag: number;
  readonly markFilteringSet?: number;
  readonly left: number;
  readonly right: number;
  readonly xAdvance: number;
  readonly device?: HintingDevice;
}

/** The format 1 device table words of `device`: two bits for each ppem, eight to a word. */
function deviceWords({ start, end, pixels }: HintingDevice): number[] {
  const count = end - start + 1;
  const deltas = Array.from({ length: Math.ceil(count / 8) }, (_, word) => {
    let bits = 0;
    for (let i = 0; i < 8; i++) bits = (bits << 2) | (word * 8 + i < count ? pixels & 0x3 : 0);
    return bits;
  });
  return words(start, end, 1, ...deltas);
}

/** A `PairPosFormat1` subtable that kerns `left` before `right` by `xAdvance`, with `device` on the advance. */
function pairPosBytes({ left, right, xAdvance, device }: KernLookup): number[] {
  const valueFormat = VALUE_X_ADVANCE | (device ? VALUE_X_ADVANCE_DEVICE : 0);
  const headerSize = 12;
  const pairSetSize = device ? 8 : 6;
  const coverage = words(1, 1, left);
  const pairSetOffset = headerSize;
  const coverageOffset = headerSize + pairSetSize;
  // A format 1 device offset counts from the `PairSet`, and the device follows the coverage.
  const deviceOffset = pairSetSize + coverage.length;
  const pairSet = words(1, right, xAdvance & 0xffff, ...(device ? [deviceOffset] : []));
  return [
    ...words(1, coverageOffset, valueFormat, 0, 1, pairSetOffset),
    ...pairSet,
    ...coverage,
    ...(device ? deviceWords(device) : []),
  ];
}

/** A `Lookup` of type 2 with one pair subtable. */
function lookupBytes(lookup: KernLookup): number[] {
  const hasMarkFilteringSet = lookup.markFilteringSet !== undefined;
  const headerSize = hasMarkFilteringSet ? 10 : 8;
  return [
    ...words(2, lookup.flag, 1, headerSize, ...(hasMarkFilteringSet ? [lookup.markFilteringSet!] : [])),
    ...pairPosBytes(lookup),
  ];
}

/** A `GPOS` whose `DFLT` script has one `kern` feature with `lookups`, in order. */
function gposBytes(lookups: readonly KernLookup[]): Uint8Array {
  const scriptList = [
    ...words(1),
    ...tagBytes('DFLT'),
    ...words(8),
    ...words(4, 0),
    ...words(0, 0xffff, 1, 0),
  ];
  const featureList = [
    ...words(1),
    ...tagBytes('kern'),
    ...words(8),
    ...words(0, lookups.length, ...lookups.map((_, i) => i)),
  ];
  const lookupTables = lookups.map(lookupBytes);
  const lookupOffsets: number[] = [];
  let at = 2 + 2 * lookups.length;
  for (const table of lookupTables) {
    lookupOffsets.push(at);
    at += table.length;
  }
  const lookupList = [...words(lookups.length, ...lookupOffsets), ...lookupTables.flat()];
  const header = 10;
  return new Uint8Array([
    ...words(1, 0, header, header + scriptList.length, header + scriptList.length + featureList.length),
    ...scriptList,
    ...featureList,
    ...lookupList,
  ]);
}

/** A `ClassDef` of format 2 that gives each glyph its class. */
function classDefWords(classes: ReadonlyMap<number, number>): number[] {
  const sorted = [...classes].sort(([a], [b]) => a - b);
  return words(2, sorted.length, ...sorted.flatMap(([glyph, glyphClass]) => [glyph, glyph, glyphClass]));
}

export interface GlyphDefinitions {
  /** `GDEF` glyph classes: 1 base, 2 ligature, 3 mark, 4 component. */
  readonly glyphClasses?: ReadonlyMap<number, number>;
  readonly markAttachClasses?: ReadonlyMap<number, number>;
  /** The glyphs of each mark glyph set, in set order. */
  readonly markGlyphSets?: readonly (readonly number[])[];
}

/** A `GDEF` 1.2 with the glyph classes, the mark attachment classes and the mark glyph sets of `definitions`. */
function gdefBytes({ glyphClasses, markAttachClasses, markGlyphSets }: GlyphDefinitions): Uint8Array {
  const header = 14;
  const body: number[] = [];
  const offsetOf = (part: number[] | null): number => {
    if (!part) return 0;
    const offset = header + body.length;
    body.push(...part);
    return offset;
  };
  const glyphClassDef = offsetOf(glyphClasses ? classDefWords(glyphClasses) : null);
  const markAttachClassDef = offsetOf(markAttachClasses ? classDefWords(markAttachClasses) : null);
  let markGlyphSetsDef = 0;
  if (markGlyphSets) {
    const coverages = markGlyphSets.map((glyphs) =>
      words(1, glyphs.length, ...[...glyphs].sort((a, b) => a - b))
    );
    let at = 4 + 4 * coverages.length;
    const offsets = coverages.flatMap((coverage) => {
      const offset = at;
      at += coverage.length;
      return words(0, offset);
    });
    markGlyphSetsDef = offsetOf([...words(1, coverages.length), ...offsets, ...coverages.flat()]);
  }
  return new Uint8Array([...words(1, 2, glyphClassDef, 0, 0, markAttachClassDef, markGlyphSetsDef), ...body]);
}

/** A variable font whose `kern` feature holds `lookups`, with `GDEF` where `definitions` gives one. */
export function syntheticKernFont(lookups: readonly KernLookup[], definitions?: GlyphDefinitions): SfntFile {
  const tables = new Map<string, Uint8Array>([
    ['fvar', fvarBytes()],
    ['GPOS', gposBytes(lookups)],
  ]);
  if (definitions) tables.set('GDEF', gdefBytes(definitions));
  return sfntFileOfTables(tables);
}

/** `wght` at 700, in the 16.16 normalised coordinates of the font: (700 - 400) / (900 - 400). */
export const BOLD_NORMALIZED = Int32Array.of(Math.round(0.6 * 0x10000));
