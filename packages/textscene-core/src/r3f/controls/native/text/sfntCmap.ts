/**
 * Reads the glyph index of a character from the `cmap` table of a TrueType font: the best Unicode
 * subtable, in format 4 (segments of two-byte codes) or format 12 (groups of consecutive codes).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

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
function firstEndAtOrAbove(count: number, endAt: (index: number) => number, target: number): number {
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
