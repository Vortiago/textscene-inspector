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

/** The flags byte: bit 0 leaves out the proportional glyphs' bearings, bit 1 the monospaced glyphs'. */
const NO_PROPORTIONAL_BEARINGS = 1;
const NO_MONOSPACED_BEARINGS = 2;
const RESERVED_FLAGS = 0xfc;

/** `hhea`: numberOfHMetrics(2) at 34. */
const HHEA_LONG_METRIC_COUNT_OFFSET = 34;
/**
 * FreeType reads the glyph count of a plain `glyf` at offset 8 of `maxp`, which holds maxPoints, not
 * numGlyphs at 4. The loader matches it, so a font Godot fails to open fails here too.
 */
const MAXP_GLYPH_COUNT_READ_OFFSET = 8;
/** `head`: indexToLocFormat(2) at 50. */
const HEAD_LOCA_FORMAT_OFFSET = 50;
/** A glyph's header: numberOfContours(2), then xMin(2). */
const GLYPH_X_MIN_OFFSET = 2;

/** `read_num_hmetrics`: the count of `(advance, bearing)` pairs in `hmtx`. Throws on an `hhea` too short. */
export function longMetricCountOf(hhea: Uint8Array): number {
  const header = ByteReader.bigEndian(hhea);
  header.seek(HHEA_LONG_METRIC_COUNT_OFFSET);
  return header.u16();
}

/** Where the tables `get_x_mins` reads start in the decoded stream. */
export interface PlainGlyfOffsets {
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
export function plainGlyfXMins(decoded: Uint8Array, offsets: PlainGlyfOffsets): Int16Array {
  const stream = ByteReader.bigEndian(decoded);
  stream.seek(offsets.maxp + MAXP_GLYPH_COUNT_READ_OFFSET);
  const glyphCount = stream.u16();
  stream.seek(offsets.head + HEAD_LOCA_FORMAT_OFFSET);
  const isLongLoca = stream.u16() !== 0;
  let locaEntry = offsets.loca;
  return Int16Array.from({ length: glyphCount }, () => {
    stream.seek(locaEntry);
    const glyphOffset = isLongLoca ? stream.u32() : stream.u16() * 2;
    locaEntry += isLongLoca ? 4 : 2;
    stream.seek(offsets.glyf + glyphOffset + GLYPH_X_MIN_OFFSET);
    return stream.i16();
  });
}

/**
 * `reconstruct_hmtx`: the plain `hmtx` of `longMetricCount` pairs and the bearings of the glyphs
 * after them. Throws, so the font does not open, on flags FreeType rejects or a stream too short.
 */
export function rebuildHmtx(transformed: Uint8Array, longMetricCount: number, xMins: Int16Array): Uint8Array {
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
