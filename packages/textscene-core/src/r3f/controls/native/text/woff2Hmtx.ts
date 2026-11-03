/**
 * Rebuilds the `hmtx` table of a font from the transformed `hmtx` table of a WOFF2 file (W3C WOFF
 * 2.0, §5.4 "Transformed hmtx table format"), as FreeType does (`sfwoff2.c`, `reconstruct_hmtx` and
 * `get_x_mins`). The transform may leave out the left side bearings, which then equal each glyph's
 * `xMin`.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ByteReader } from '../../../../resources/formats/binaryresource/byteReader';
import { GLYPH_X_MIN_OFFSET, locaEntry, SHORT_LOCA_FORMAT } from './glyfFormat';
import { HEAD_INDEX_TO_LOC_FORMAT_OFFSET, readLongMetricCount } from './sfntTables';

/** The flags byte: bit 0 leaves out the proportional glyphs' bearings, bit 1 the monospaced glyphs'. */
const NO_PROPORTIONAL_BEARINGS = 1;
const NO_MONOSPACED_BEARINGS = 2;
const RESERVED_FLAGS = 0xfc;

/**
 * FreeType reads the glyph count of a plain `glyf` at offset 8 of `maxp`, which holds maxPoints, not
 * numGlyphs at 4. The loader matches it, so a font Godot fails to open fails here too.
 */
const MAXP_GLYPH_COUNT_READ_OFFSET = 8;

/** A table as the decoded WOFF2 stream stores it: its bytes, and where they start in the stream. */
export interface DecodedTable {
  readonly bytes: Uint8Array;
  readonly offset: number;
}

/** A view of all of `bytes`, which throws on a read past their end. */
function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** `read_num_hmetrics`: the count of `(advance, bearing)` pairs in `hmtx`. Throws on an `hhea` too short. */
function longMetricCountOf(hhea: Uint8Array): number {
  return readLongMetricCount(viewOf(hhea), { offset: 0, length: hhea.length });
}

/** Where the tables `get_x_mins` reads start in the decoded stream. */
interface PlainGlyfOffsets {
  maxp: number;
  head: number;
  loca: number;
  glyf: number;
}

/**
 * `get_x_mins`: each glyph's `xMin` in a plain `glyf`, read at the offset `loca` gives it. FreeType
 * reads anywhere in the decoded stream, past a table's end too, and an empty glyph reads the header
 * of the glyph after it. Throws on a read past the stream.
 */
function plainGlyfXMins(decoded: Uint8Array, offsets: PlainGlyfOffsets): Int16Array {
  const stream = viewOf(decoded);
  const glyphCount = stream.getUint16(offsets.maxp + MAXP_GLYPH_COUNT_READ_OFFSET, false);
  const isLongLoca =
    stream.getUint16(offsets.head + HEAD_INDEX_TO_LOC_FORMAT_OFFSET, false) !== SHORT_LOCA_FORMAT;
  return Int16Array.from({ length: glyphCount }, (_, glyphIndex) => {
    const glyphOffset = locaEntry(stream, offsets.loca, glyphIndex, isLongLoca);
    return stream.getInt16(offsets.glyf + glyphOffset + GLYPH_X_MIN_OFFSET, false);
  });
}

/** The `xMin` of each glyph, from the rebuilt `glyf` or else the plain one. Throws without the tables. */
function glyphXMinsOf(
  decoded: Uint8Array,
  stored: ReadonlyMap<string, DecodedTable>,
  rebuiltXMins: Int16Array | null
): Int16Array {
  if (rebuiltXMins) return rebuiltXMins;
  const offsetOf = (tag: string) => tableOf(stored, tag).offset;
  return plainGlyfXMins(decoded, {
    maxp: offsetOf('maxp'),
    head: offsetOf('head'),
    loca: offsetOf('loca'),
    glyf: offsetOf('glyf'),
  });
}

function tableOf(stored: ReadonlyMap<string, DecodedTable>, tag: string): DecodedTable {
  const table = stored.get(tag);
  if (!table) throw new Error(`expected the ${tag} table beside a transformed hmtx, got none`);
  return table;
}

/**
 * The plain `hmtx` of a WOFF2 font whose stored `hmtx` is transformed, with the side bearings it
 * leaves out from the `xMins` of the rebuilt `glyf`, or of the plain one in `decoded`. Throws on a
 * font without `hhea` or the tables the plain `xMins` read, or on a transform FreeType rejects.
 */
export function rebuiltHmtxOf(
  decoded: Uint8Array,
  stored: ReadonlyMap<string, DecodedTable>,
  rebuiltXMins: Int16Array | null
): Uint8Array {
  const hmtx = tableOf(stored, 'hmtx');
  const longMetricCount = longMetricCountOf(tableOf(stored, 'hhea').bytes);
  return rebuildHmtx(hmtx.bytes, longMetricCount, glyphXMinsOf(decoded, stored, rebuiltXMins));
}

/**
 * `reconstruct_hmtx`: the plain `hmtx` of `longMetricCount` pairs and the bearings of the glyphs
 * after them. Throws, so the font does not open, on flags FreeType rejects or a stream too short.
 */
function rebuildHmtx(transformed: Uint8Array, longMetricCount: number, xMins: Int16Array): Uint8Array {
  const glyphCount = xMins.length;
  const stream = ByteReader.bigEndian(transformed);
  const flags = stream.u8();
  if ((flags & RESERVED_FLAGS) !== 0) throw new Error(`expected hmtx flags of 0 to 3, got ${flags}`);
  const hasProportionalBearings = (flags & NO_PROPORTIONAL_BEARINGS) === 0;
  const hasMonospacedBearings = (flags & NO_MONOSPACED_BEARINGS) === 0;
  if (hasProportionalBearings && hasMonospacedBearings)
    throw new Error('expected a transformed hmtx to leave out some side bearings, got all of them');
  if (longMetricCount < 1 || longMetricCount > glyphCount)
    throw new Error(`expected 1 to ${glyphCount} long horizontal metrics, got ${longMetricCount}`);

  const advances = Array.from({ length: longMetricCount }, () => stream.u16());
  const bearings = Array.from({ length: glyphCount }, (_, index) => {
    const isStored = index < longMetricCount ? hasProportionalBearings : hasMonospacedBearings;
    return isStored ? stream.i16() : xMins[index]!;
  });

  const hmtx = new DataView(new ArrayBuffer(2 * longMetricCount + 2 * glyphCount));
  let at = 0;
  bearings.forEach((bearing, index) => {
    if (index < longMetricCount) {
      hmtx.setUint16(at, advances[index]!, false);
      at += 2;
    }
    hmtx.setInt16(at, bearing, false);
    at += 2;
  });
  return new Uint8Array(hmtx.buffer);
}
