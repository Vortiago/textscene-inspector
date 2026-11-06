/**
 * Reads the glyph index of a character from the `cmap` table of a TrueType font: the best Unicode
 * subtable, in format 4 (segments of two-byte codes) or format 12 (groups of consecutive codes).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { perObject } from '../../../../utils/perObject';
import { drawnCharacters } from './canonicalGlyphs';
import { readGlyphCount, type SfntFile } from './sfntTables';

/** `cmap` platform and encoding of each Unicode subtable, best first, as HarfBuzz ranks them (`hb-ot-cmap-table.hh`). */
const CMAP_SUBTABLE_RANK: readonly (readonly [platform: number, encoding: number])[] = [
  [3, 10],
  [0, 6],
  [0, 4],
  [3, 1],
  [0, 3],
  [0, 2],
  [0, 1],
  [0, 0],
];

const CMAP_FORMAT_SEGMENTED = 4;
const CMAP_FORMAT_GROUPED = 12;

function findCmapSubtable(dv: DataView, cmapOffset: number): number | null {
  const recordCount = dv.getUint16(cmapOffset + 2, false);
  for (const [platform, encoding] of CMAP_SUBTABLE_RANK) {
    for (let i = 0; i < recordCount; i++) {
      const record = cmapOffset + 4 + i * 8;
      if (dv.getUint16(record, false) !== platform || dv.getUint16(record + 2, false) !== encoding) continue;
      const subtable = cmapOffset + dv.getUint32(record + 4, false);
      const format = dv.getUint16(subtable, false);
      if (format === CMAP_FORMAT_SEGMENTED || format === CMAP_FORMAT_GROUPED) return subtable;
    }
  }
  return null;
}

/** Binary search for the first of `count` ascending entries whose end is at or above `target`. */
export function firstEndAtOrAbove(count: number, endAt: (index: number) => number, target: number): number {
  let low = 0;
  let high = count;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (endAt(middle) < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** `cmap` format 4: segments of two-byte codes, each mapped by a delta or through a glyph-id array. */
function segmentedGlyphIndex(dv: DataView, subtable: number, codePoint: number): number {
  if (codePoint > 0xffff) return 0;
  const segmentCount = dv.getUint16(subtable + 6, false) / 2;
  const endCodes = subtable + 14;
  const startCodes = endCodes + segmentCount * 2 + 2;
  const idDeltas = startCodes + segmentCount * 2;
  const idRangeOffsets = idDeltas + segmentCount * 2;
  const segment = firstEndAtOrAbove(segmentCount, (i) => dv.getUint16(endCodes + i * 2, false), codePoint);
  if (segment >= segmentCount || dv.getUint16(startCodes + segment * 2, false) > codePoint) return 0;
  const idDelta = dv.getUint16(idDeltas + segment * 2, false);
  const rangeOffsetAt = idRangeOffsets + segment * 2;
  const rangeOffset = dv.getUint16(rangeOffsetAt, false);
  if (rangeOffset === 0) return (codePoint + idDelta) & 0xffff;
  const start = dv.getUint16(startCodes + segment * 2, false);
  const glyph = dv.getUint16(rangeOffsetAt + rangeOffset + (codePoint - start) * 2, false);
  return glyph === 0 ? 0 : (glyph + idDelta) & 0xffff;
}

/** `cmap` format 12: groups of consecutive code points mapped to consecutive glyphs. */
function groupedGlyphIndex(dv: DataView, subtable: number, codePoint: number): number {
  const groupCount = dv.getUint32(subtable + 12, false);
  const groups = subtable + 16;
  const group = firstEndAtOrAbove(groupCount, (i) => dv.getUint32(groups + i * 12 + 4, false), codePoint);
  if (group >= groupCount) return 0;
  const start = dv.getUint32(groups + group * 12, false);
  if (start > codePoint) return 0;
  return dv.getUint32(groups + group * 12 + 8, false) + (codePoint - start);
}

/** The glyph-index lookup of the best Unicode subtable of `cmap`, or null for a font with none we read. */
export function cmapLookup(dv: DataView, cmapOffset: number): ((codePoint: number) => number) | null {
  const subtable = findCmapSubtable(dv, cmapOffset);
  if (subtable === null) return null;
  const read =
    dv.getUint16(subtable, false) === CMAP_FORMAT_SEGMENTED ? segmentedGlyphIndex : groupedGlyphIndex;
  return (codePoint) => read(dv, subtable, codePoint);
}

/** The code points of a format 4 subtable with a glyph below `glyphCount`, ascending. */
function segmentedCodePoints(dv: DataView, subtable: number, glyphCount: number): number[] {
  const segmentCount = dv.getUint16(subtable + 6, false) / 2;
  const endCodes = subtable + 14;
  const startCodes = endCodes + segmentCount * 2 + 2;
  const codePoints: number[] = [];
  for (let segment = 0; segment < segmentCount; segment++) {
    const start = dv.getUint16(startCodes + segment * 2, false);
    const end = dv.getUint16(endCodes + segment * 2, false);
    for (let codePoint = start; codePoint <= end && codePoint < 0xffff; codePoint++) {
      const glyph = segmentedGlyphIndex(dv, subtable, codePoint);
      if (glyph !== 0 && glyph < glyphCount) codePoints.push(codePoint);
    }
  }
  return codePoints;
}

/** The code points of a format 12 subtable with a glyph below `glyphCount`, ascending. */
function groupedCodePoints(dv: DataView, subtable: number, glyphCount: number): number[] {
  const groupCount = dv.getUint32(subtable + 12, false);
  const codePoints: number[] = [];
  for (let group = 0; group < groupCount; group++) {
    const at = subtable + 16 + group * 12;
    const start = dv.getUint32(at, false);
    const end = dv.getUint32(at + 4, false);
    const startGlyph = dv.getUint32(at + 8, false);
    const last = Math.min(end, start + glyphCount - 1 - startGlyph);
    const first = startGlyph === 0 ? start + 1 : start;
    for (let codePoint = first; codePoint <= last; codePoint++) codePoints.push(codePoint);
  }
  return codePoints;
}

/**
 * The code points the best Unicode subtable maps to a glyph below `glyphCount`, ascending, as
 * FreeType's `FT_Get_Next_Char` walks them, or null for a font with no subtable we read.
 */
export function cmapCodePoints(dv: DataView, cmapOffset: number, glyphCount: number): number[] | null {
  const subtable = findCmapSubtable(dv, cmapOffset);
  if (subtable === null) return null;
  if (dv.getUint16(subtable, false) === CMAP_FORMAT_GROUPED)
    return groupedCodePoints(dv, subtable, glyphCount);
  return segmentedCodePoints(dv, subtable, glyphCount);
}

/**
 * Whether `sfnt` maps a character to a glyph other than `.notdef`, which `_font_has_char` asks
 * FreeType. `FT_Get_Char_Index` answers 0 for an index at or past `maxp.numGlyphs`. Null for a font
 * with no `cmap` subtable this module reads.
 */
export const sfntMapsGlyph = perObject((sfnt: SfntFile): ((ch: string) => boolean) | null => {
  const glyphIndexOf = sfntGlyphIndex(sfnt);
  if (!glyphIndexOf) return null;
  const glyphCount = readGlyphCount(sfnt) ?? Infinity;
  return (ch) => {
    const glyphIndex = glyphIndexOf(ch.codePointAt(0)!);
    return glyphIndex !== 0 && glyphIndex < glyphCount;
  };
});

/**
 * The glyphs `sfnt` draws a character as (`drawnCharacters`), read once per code point: the shaper
 * asks for each character on every pass. Null for a font with no `cmap` subtable this module reads.
 */
export const sfntDrawnCharacters = perObject(
  (sfnt: SfntFile): ((ch: string) => readonly string[] | null) | null => {
    const mapsGlyph = sfntMapsGlyph(sfnt);
    if (!mapsGlyph) return null;
    const drawnByCodePoint = new Map<number, readonly string[] | null>();
    return (ch) => {
      const codePoint = ch.codePointAt(0)!;
      let drawn = drawnByCodePoint.get(codePoint);
      if (drawn === undefined) drawnByCodePoint.set(codePoint, (drawn = drawnCharacters(ch, mapsGlyph)));
      return drawn;
    };
  }
);

/**
 * Whether `sfnt` draws a character without `.notdef`: `sfntMapsGlyph`, or every piece of its
 * canonical decomposition has a glyph, as HarfBuzz shapes it. A font with no `cmap` subtable this
 * module reads answers true, so its text keeps it.
 */
export function sfntHasGlyph(sfnt: SfntFile): (ch: string) => boolean {
  const drawnOf = sfntDrawnCharacters(sfnt);
  return drawnOf ? (ch) => drawnOf(ch) !== null : () => true;
}

/**
 * The glyph index of a code point through the `cmap` of `sfnt`, 0 for none or for a read a malformed
 * table sends past the end. Null for a font with no subtable this module reads.
 */
export const sfntGlyphIndex = perObject((sfnt: SfntFile): ((codePoint: number) => number) | null => {
  const cmap = sfnt.tables.get('cmap');
  const lookup = cmap ? orOnRangeError(() => cmapLookup(sfnt.dv, cmap.offset), null) : null;
  return lookup && ((codePoint) => orOnRangeError(() => lookup(codePoint), 0));
});

/** `read()`, or `fallback` where a malformed table sends it past the end of the bytes. */
export function orOnRangeError<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return fallback;
  }
}
