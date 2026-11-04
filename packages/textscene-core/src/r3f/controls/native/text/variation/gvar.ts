/**
 * The glyph variations of a font (`gvar`): the deltas that move a glyph's points, and its four
 * phantom points, to an instance, with the deltas of untouched points inferred as the IUP
 * instruction does (`ttgxvar.c`, `ft_var_load_gvar`, `TT_Vary_Apply_Glyph_Deltas` and
 * `tt_interpolate_deltas`).
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ftDivFix, ftMulFix } from '../fontMetrics';
import { tableFits, type SfntFile } from '../sfntTables';
import { fdot14ToFixed, fixedToFdot6, fixedToInt, intToFixed } from './fixedPoint';
import {
  InvalidTupleVariationsError,
  activeTuples,
  readPackedDeltas,
  type TuplePoints,
} from './tupleVariations';

/** `gvar` through `offsetToData`, `glyphCount` and `flags`. */
const GVAR_HEADER_SIZE = 20;
const GVAR_VERSION = 0x00010000;
const LONG_OFFSETS = 1;
/** `Fixed 26.6` of a font unit: a point at 64 times its value. */
const FDOT6_ONE = 64;

/** The `gvar` of a font, read for its header. */
export interface GlyphVariations {
  readonly bytes: Uint8Array;
  readonly axisCount: number;
  /** The offset in the font of each glyph's data and one past the last, never decreasing. */
  readonly glyphOffsets: Float64Array;
  /** The tuples the tuple indices of glyphs point to. */
  readonly sharedTuples: Int32Array;
}

/**
 * The glyph variations of the font, null when it has no `gvar`, which FreeType accepts, or
 * 'invalid' when the table is there and FreeType rejects it, so that the font stays at its default.
 */
export function readGlyphVariations(sfnt: SfntFile, axisCount: number): GlyphVariations | null | 'invalid' {
  const { dv } = sfnt;
  const gvar = sfnt.tables.get('gvar');
  if (!gvar) return null;
  if (!tableFits(dv, gvar, GVAR_HEADER_SIZE)) return 'invalid';
  const at = gvar.offset;
  const sharedTupleCount = dv.getUint16(at + 6, false);
  const sharedTuplesOffset = dv.getUint32(at + 8, false);
  const glyphCount = dv.getUint16(at + 12, false);
  const flags = dv.getUint16(at + 14, false);
  const dataOffset = at + dv.getUint32(at + 16, false);
  const offsetSize = flags & LONG_OFFSETS ? 4 : 2;
  const tableEnd = at + gvar.length;

  const isValid =
    dv.getInt32(at, false) === GVAR_VERSION &&
    dv.getUint16(at + 4, false) === axisCount &&
    sharedTupleCount * axisCount <= Math.floor(gvar.length / 2) &&
    (glyphCount + 1) * offsetSize <= gvar.length &&
    at + GVAR_HEADER_SIZE + (glyphCount + 1) * offsetSize <= dv.byteLength &&
    (sharedTupleCount === 0 || sharedTuplesOffset + sharedTupleCount * axisCount * 2 <= dv.byteLength - at);
  if (!isValid) return 'invalid';

  const glyphOffsets = new Float64Array(glyphCount + 1);
  let largest = 0;
  for (let glyph = 0; glyph <= glyphCount; glyph++) {
    const entryAt = at + GVAR_HEADER_SIZE + glyph * offsetSize;
    const entry = flags & LONG_OFFSETS ? dv.getUint32(entryAt, false) : dv.getUint16(entryAt, false) * 2;
    // A decreasing offset takes the largest so far, and one past the table takes its end.
    largest = Math.max(largest, dataOffset + entry);
    glyphOffsets[glyph] = Math.min(largest, tableEnd);
  }
  const sharedTuples = Int32Array.from({ length: sharedTupleCount * axisCount }, (_, index) =>
    fdot14ToFixed(dv.getInt16(at + sharedTuplesOffset + index * 2, false))
  );
  return {
    bytes: new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength),
    axisCount,
    glyphOffsets,
    sharedTuples,
  };
}

/** The points of a glyph in font units, the four phantom points last, and the contours of the glyph's own. */
export interface GlyphPoints {
  readonly x: ArrayLike<number>;
  readonly y: ArrayLike<number>;
  readonly contourEnds: ArrayLike<number>;
}

/** Which phantom points an HVAR or VVAR table has already adjusted, so that their deltas do not move them again. */
export interface AdjustedAdvances {
  readonly horizontal: boolean;
  readonly vertical: boolean;
}

/** The points at the instance: whole font units, as the interpreter's unscaled points, and the 26.6 ones the scaling reads. */
export interface VariedPoints {
  readonly x: number[];
  readonly y: number[];
  readonly unroundedX: number[];
  readonly unroundedY: number[];
}

type Axis = Float64Array;

/** `tt_delta_shift`: moves every point of `first` to `last` but `reference` by the delta of `reference`. */
function shiftContour(first: number, last: number, reference: number, original: Axis, varied: Axis): void {
  const delta = varied[reference]! - original[reference]!;
  if (delta === 0) return;
  for (let point = first; point <= last; point++) if (point !== reference) varied[point]! += delta;
}

/**
 * `tt_delta_interpolate` on one axis: the points from `first` to `last` take the delta of the nearer
 * reference, or an interpolated one between them. FreeType swaps the references to put the lower
 * first on x, and keeps the swap for y: `references` carries it.
 */
function interpolateAxis(
  first: number,
  last: number,
  references: [number, number],
  original: Axis,
  varied: Axis
): void {
  if (original[references[0]]! > original[references[1]]!) references.reverse();
  const [reference1, reference2] = references;
  const in1 = original[reference1]!;
  const in2 = original[reference2]!;
  const out1 = varied[reference1]!;
  const out2 = varied[reference2]!;
  const delta1 = out1 - in1;
  const delta2 = out2 - in2;
  // Two references at one coordinate with different deltas infer no delta.
  if (in1 === in2 && out1 !== out2) return;
  const scale = in1 !== in2 ? ftDivFix(out2 - out1, in2 - in1) : 0;
  for (let point = first; point <= last; point++) {
    const coordinate = original[point]!;
    varied[point] =
      coordinate <= in1
        ? coordinate + delta1
        : coordinate >= in2
          ? coordinate + delta2
          : out1 + ftMulFix(coordinate - in1, scale);
  }
}

function interpolate(
  first: number,
  last: number,
  reference1: number,
  reference2: number,
  original: readonly [Axis, Axis],
  varied: readonly [Axis, Axis]
): void {
  if (first > last) return;
  const references: [number, number] = [reference1, reference2];
  interpolateAxis(first, last, references, original[0], varied[0]);
  interpolateAxis(first, last, references, original[1], varied[1]);
}

/** `tt_interpolate_deltas`: the points of a contour that no delta names follow the points that one names. */
function interpolateDeltas(
  contourEnds: ArrayLike<number>,
  original: readonly [Axis, Axis],
  varied: readonly [Axis, Axis],
  hasDelta: Uint8Array
): void {
  let point = 0;
  for (let contour = 0; contour < contourEnds.length; contour++) {
    const end = contourEnds[contour]!;
    const first = point;
    while (point <= end && !hasDelta[point]) point++;
    if (point > end) continue;

    const firstDelta = point;
    let currentDelta = point;
    point++;
    while (point <= end) {
      if (hasDelta[point]) {
        interpolate(currentDelta + 1, point - 1, currentDelta, point, original, varied);
        currentDelta = point;
      }
      point++;
    }
    if (currentDelta === firstDelta) {
      shiftContour(first, end, currentDelta, original[0], varied[0]);
      shiftContour(first, end, currentDelta, original[1], varied[1]);
    } else {
      interpolate(currentDelta + 1, end, currentDelta, firstDelta, original, varied);
      if (firstDelta > 0) interpolate(first, firstDelta - 1, currentDelta, firstDelta, original, varied);
    }
  }
}

/** The deltas of one tuple, a per-point run for each axis, or null when FreeType ignores the tuple. */
function tupleDeltas(
  table: GlyphVariations,
  points: TuplePoints | null,
  deltasAt: number,
  limit: number,
  pointCount: number
): { x: Int32Array; y: Int32Array } | null {
  if (!points) return null;
  const count = points === 'all' ? pointCount : points.length;
  const x = readPackedDeltas(table.bytes, deltasAt, limit, count);
  const y = x && readPackedDeltas(table.bytes, x.end, limit, count);
  return x && y ? { x: x.deltas, y: y.deltas } : null;
}

/**
 * `TT_Vary_Apply_Glyph_Deltas`: the points of glyph `glyphIndex` at the normalised coordinates. A glyph
 * with no variation data, and a font with no `gvar` (a null table), keep their points. It throws {@link InvalidTupleVariationsError} for a table
 * that FreeType refuses, which fails the glyph's load.
 */
export function variedGlyphPoints(
  table: GlyphVariations | null,
  normalized: Int32Array,
  glyphIndex: number,
  { x, y, contourEnds }: GlyphPoints,
  adjusted: AdjustedAdvances
): VariedPoints {
  const pointCount = x.length;
  const accumulated = [new Float64Array(pointCount), new Float64Array(pointCount)] as const;
  const dataStart = table?.glyphOffsets[glyphIndex];
  const dataEnd = table?.glyphOffsets[glyphIndex + 1];
  if (table && dataStart !== undefined && dataEnd !== undefined && dataStart !== dataEnd) {
    const dataSize = dataEnd - dataStart;
    if (dataEnd > table.bytes.length)
      throw new InvalidTupleVariationsError('glyph variation data past the font');
    const tupleCount = ((table.bytes[dataStart]! << 8) | table.bytes[dataStart + 1]!) & 0x0fff;
    const dataOffset = (table.bytes[dataStart + 2]! << 8) | table.bytes[dataStart + 3]!;
    if (dataOffset > dataSize || tupleCount * 4 > dataSize)
      throw new InvalidTupleVariationsError('invalid glyph variation array header');

    const tuples = activeTuples(
      {
        bytes: table.bytes,
        headerAt: dataStart,
        dataStart,
        limit: dataEnd,
        sharedTuples: table.sharedTuples,
        axisCount: table.axisCount,
      },
      normalized
    );
    const original = [Float64Array.from(x, intToFixed), Float64Array.from(y, intToFixed)] as const;
    for (const { apply, points, deltasAt } of tuples) {
      const deltas = tupleDeltas(table, points, deltasAt, dataEnd, pointCount);
      if (!deltas || !points) continue;
      if (points === 'all') {
        for (let point = 0; point < pointCount; point++) {
          accumulated[0][point]! += ftMulFix(deltas.x[point]!, apply);
          accumulated[1][point]! += ftMulFix(deltas.y[point]!, apply);
        }
        continue;
      }
      const varied = [Float64Array.from(original[0]), Float64Array.from(original[1])] as const;
      const hasDelta = new Uint8Array(pointCount);
      points.forEach((point, index) => {
        if (point >= pointCount) return;
        hasDelta[point] = 1;
        varied[0][point]! += ftMulFix(deltas.x[index]!, apply);
        varied[1][point]! += ftMulFix(deltas.y[index]!, apply);
      });
      // The phantom points follow the contours' last point, so no contour reaches them.
      interpolateDeltas(contourEnds, original, varied, hasDelta);
      for (let point = 0; point < pointCount; point++) {
        accumulated[0][point]! += varied[0][point]! - original[0][point]!;
        accumulated[1][point]! += varied[1][point]! - original[1][point]!;
      }
    }
  }

  // The advances that HVAR or VVAR adjust already must not move again by the phantom deltas.
  const phantomStart = pointCount - 4;
  const fixedPhantoms = [
    ...(adjusted.horizontal ? [phantomStart, phantomStart + 1] : []),
    ...(adjusted.vertical ? [phantomStart + 2, phantomStart + 3] : []),
  ];
  for (const point of fixedPhantoms) {
    accumulated[0][point] = 0;
    accumulated[1][point] = 0;
  }
  return {
    x: Array.from(x, (value, point) => value + fixedToInt(accumulated[0][point]!)),
    y: Array.from(y, (value, point) => value + fixedToInt(accumulated[1][point]!)),
    unroundedX: Array.from(x, (value, point) => value * FDOT6_ONE + fixedToFdot6(accumulated[0][point]!)),
    unroundedY: Array.from(y, (value, point) => value * FDOT6_ONE + fixedToFdot6(accumulated[1][point]!)),
  };
}
