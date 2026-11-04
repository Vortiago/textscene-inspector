/**
 * The tuple variation data that `gvar` holds for each glyph and `cvar` for the control values
 * (`ttgxvar.c`, `ft_var_readpackedpoints`, `ft_var_readpackeddeltas`, `ft_var_apply_tuple`): which
 * tuples apply to the normalised coordinates, how much, and where their point numbers and deltas lie.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ftMulDiv } from '../fontMetrics';
import { fdot14ToFixed, intToFixed } from './fixedPoint';

/** The points of a tuple: their numbers, or every point of the glyph or table. */
export type TuplePoints = Uint16Array | 'all';

const POINTS_ARE_WORDS = 0x80;
const POINT_RUN_COUNT_MASK = 0x7f;
const DELTAS_ARE_ZERO = 0x80;
const DELTAS_ARE_WORDS = 0x40;
const DELTA_RUN_COUNT_MASK = 0x3f;

const TUPLES_SHARE_POINT_NUMBERS = 0x8000;
const TUPLE_COUNT_MASK = 0x0fff;
const EMBEDDED_TUPLE_COORD = 0x8000;
const INTERMEDIATE_TUPLE = 0x4000;
const PRIVATE_POINT_NUMBERS = 0x2000;
const TUPLE_INDEX_MASK = 0x0fff;

/** A tuple variation table that FreeType rejects with `Invalid_Table`. */
export class InvalidTupleVariationsError extends Error {}

/** A read at `at` of the bytes of the font, which answers 0 past the end as a stream's cursor would not fault. */
const byteAt = (bytes: Uint8Array, at: number): number => bytes[at] ?? 0;
const ushortAt = (bytes: Uint8Array, at: number): number => (byteAt(bytes, at) << 8) | byteAt(bytes, at + 1);
const shortAt = (bytes: Uint8Array, at: number): number => (ushortAt(bytes, at) << 16) >> 16;

/** A set of point numbers and the offset after it; `points` is null when FreeType finds the set invalid. */
interface PackedPoints {
  readonly points: TuplePoints | null;
  readonly end: number;
}

/** `ft_var_readpackedpoints`: `limit` is the end of the data the table owns. */
function readPackedPoints(bytes: Uint8Array, start: number, limit: number): PackedPoints {
  let at = start;
  let count = byteAt(bytes, at++);
  if (count === 0) return { points: 'all', end: at };
  if (count & POINTS_ARE_WORDS) count = ((count & POINT_RUN_COUNT_MASK) << 8) | byteAt(bytes, at++);

  const afterCount = at;
  const points = new Uint16Array(count);
  let first = 0;
  for (let index = 0; index < count;) {
    if (at >= limit) return { points: null, end: afterCount };
    const runHeader = byteAt(bytes, at++);
    const runLength = Math.min((runHeader & POINT_RUN_COUNT_MASK) + 1, count - index);
    const width = runHeader & POINTS_ARE_WORDS ? 2 : 1;
    if (width * runLength > limit - at) return { points: null, end: afterCount };
    for (let step = 0; step < runLength; step++, at += width)
      points[index++] = first = (first + (width === 2 ? ushortAt(bytes, at) : byteAt(bytes, at))) & 0xffff;
  }
  return { points, end: at };
}

/** A run of deltas in 16.16, or null when FreeType finds the data invalid. */
export function readPackedDeltas(
  bytes: Uint8Array,
  start: number,
  limit: number,
  count: number
): { deltas: Int32Array; end: number } | null {
  const deltas = new Int32Array(count);
  let at = start;
  for (let index = 0; index < count;) {
    if (at >= limit) return null;
    const runHeader = byteAt(bytes, at++);
    const runLength = Math.min((runHeader & DELTA_RUN_COUNT_MASK) + 1, count - index);
    if (runHeader & DELTAS_ARE_ZERO) {
      index += runLength;
      continue;
    }
    const width = runHeader & DELTAS_ARE_WORDS ? 2 : 1;
    if (width * runLength > limit - at) return null;
    for (let step = 0; step < runLength; step++, at += width)
      deltas[index++] = intToFixed(width === 2 ? shortAt(bytes, at) : (byteAt(bytes, at) << 24) >> 24);
  }
  return { deltas, end: at };
}

/** `ft_var_apply_tuple`: how much of its deltas a tuple gives the normalised coordinates, in 16.16. */
function tupleScalar(
  normalized: Int32Array,
  tupleIndex: number,
  peak: Int32Array,
  intermediateStart: Int32Array,
  intermediateEnd: Int32Array
): number {
  let apply = 0x10000;
  for (let axis = 0; axis < normalized.length; axis++) {
    const tuple = peak[axis]!;
    if (tuple === 0) continue;
    const coordinate = normalized[axis]!;
    if (coordinate === 0) return 0;
    if (tuple === coordinate) continue;

    if (!(tupleIndex & INTERMEDIATE_TUPLE)) {
      if ((tuple > coordinate && coordinate > 0) || (tuple < coordinate && coordinate < 0))
        apply = ftMulDiv(apply, coordinate, tuple);
      else return 0;
    } else {
      const start = intermediateStart[axis]!;
      const end = intermediateEnd[axis]!;
      if (coordinate <= start || coordinate >= end) return 0;
      apply =
        coordinate < tuple
          ? ftMulDiv(apply, coordinate - start, tuple - start)
          : ftMulDiv(apply, end - coordinate, end - tuple);
    }
  }
  return apply;
}

/** One tuple that applies, with the offset in the font where its deltas start. */
export interface ActiveTuple {
  readonly apply: number;
  /** Null when FreeType finds the point numbers invalid, so it ignores the tuple's deltas. */
  readonly points: TuplePoints | null;
  readonly deltasAt: number;
}

/** Where a table's tuple variations lie, and what they are read against. */
interface TupleVariationTable {
  /** The bytes of the whole font. */
  readonly bytes: Uint8Array;
  /** The offset of the tuple count: the header, then the tuple headers. */
  readonly headerAt: number;
  /** The offset of the serialised data that the header's offset counts from. */
  readonly dataStart: number;
  /** The end of the table's data. */
  readonly limit: number;
  /** The tuples a tuple index points to, `axisCount` entries each, in 16.16. */
  readonly sharedTuples: Int32Array;
  readonly axisCount: number;
}

/**
 * `TT_Vary_Apply_Glyph_Deltas` and `tt_face_vary_cvt` on the header of a tuple variation table: the tuples
 * that apply to `normalized`, in table order. It throws {@link InvalidTupleVariationsError} for the headers
 * FreeType refuses.
 */
export function activeTuples(
  { bytes, headerAt, dataStart, limit, sharedTuples, axisCount }: TupleVariationTable,
  normalized: Int32Array
): ActiveTuple[] {
  const countField = ushortAt(bytes, headerAt);
  let dataAt = dataStart + ushortAt(bytes, headerAt + 2);
  let sharedPoints: PackedPoints | null = null;
  if (countField & TUPLES_SHARE_POINT_NUMBERS) {
    sharedPoints = readPackedPoints(bytes, dataAt, limit);
    dataAt = sharedPoints.end;
  }

  const peak = new Int32Array(axisCount);
  const intermediateStart = new Int32Array(axisCount);
  const intermediateEnd = new Int32Array(axisCount);
  const sharedTupleCount = sharedTuples.length / axisCount;
  const active: ActiveTuple[] = [];
  let at = headerAt + 4;
  for (let tuple = 0; tuple < (countField & TUPLE_COUNT_MASK); tuple++) {
    if (4 > limit - at) throw new InvalidTupleVariationsError('invalid glyph variation array header');
    const dataSize = ushortAt(bytes, at);
    const tupleIndex = ushortAt(bytes, at + 2);
    at += 4;

    let tupleCoordinates: Int32Array;
    if (tupleIndex & EMBEDDED_TUPLE_COORD) {
      if (2 * axisCount > limit - at)
        throw new InvalidTupleVariationsError('invalid glyph variation array header');
      for (let axis = 0; axis < axisCount; axis++, at += 2) peak[axis] = fdot14ToFixed(shortAt(bytes, at));
      tupleCoordinates = peak;
    } else if ((tupleIndex & TUPLE_INDEX_MASK) < sharedTupleCount) {
      const first = (tupleIndex & TUPLE_INDEX_MASK) * axisCount;
      tupleCoordinates = sharedTuples.subarray(first, first + axisCount);
    } else throw new InvalidTupleVariationsError('invalid tuple index');

    if (tupleIndex & INTERMEDIATE_TUPLE) {
      if (4 * axisCount > limit - at)
        throw new InvalidTupleVariationsError('invalid glyph variation array header');
      for (let axis = 0; axis < axisCount; axis++, at += 2)
        intermediateStart[axis] = fdot14ToFixed(shortAt(bytes, at));
      for (let axis = 0; axis < axisCount; axis++, at += 2)
        intermediateEnd[axis] = fdot14ToFixed(shortAt(bytes, at));
    }

    const apply = tupleScalar(normalized, tupleIndex, tupleCoordinates, intermediateStart, intermediateEnd);
    if (apply !== 0) {
      const own = tupleIndex & PRIVATE_POINT_NUMBERS ? readPackedPoints(bytes, dataAt, limit) : null;
      active.push({
        apply,
        points: own ? own.points : (sharedPoints?.points ?? null),
        deltasAt: own ? own.end : dataAt,
      });
    }
    dataAt += dataSize;
  }
  return active;
}
