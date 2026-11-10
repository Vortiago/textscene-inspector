/**
 * The control value variations of a font (`cvar`): the deltas that move its `cvt ` entries to an
 * instance before the control value program runs (`ttgxvar.c`, `tt_face_vary_cvt`).
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ftMulFix } from '../fontMetrics';
import { fixedToFdot6 } from './fixedPoint';
import {
  InvalidTupleVariationsError,
  TUPLE_COUNT_MASK,
  activeTuples,
  readPackedDeltas,
} from './tupleVariations';
import type { SfntFile } from '../sfntTables';

const CVAR_VERSION = 0x00010000;
const CVAR_HEADER_SIZE = 8;

/**
 * The control values of the font at the normalised coordinates, in 26.6 font units, or null when the
 * font has no `cvar` or FreeType ignores it. It throws `InvalidTupleVariationsError` for a table that
 * FreeType refuses.
 *
 * @param controlValues The `cvt ` table in 26.6, one entry for each value.
 * @param sharedTuples The tuples of `gvar`, which a `cvar` tuple index points to.
 */
export function variedControlValues(
  sfnt: SfntFile,
  controlValues: Int32Array,
  axisCount: number,
  sharedTuples: Int32Array,
  normalized: Int32Array
): Int32Array | null {
  const { dv } = sfnt;
  const cvar = sfnt.tables.get('cvar');
  if (!cvar || controlValues.length === 0 || cvar.length < CVAR_HEADER_SIZE) return null;
  if (cvar.offset + cvar.length > dv.byteLength || dv.getInt32(cvar.offset, false) !== CVAR_VERSION)
    return null;

  const tupleCount = dv.getUint16(cvar.offset + 4, false) & TUPLE_COUNT_MASK;
  if (dv.getUint16(cvar.offset + 6, false) + tupleCount * 4 > cvar.length)
    throw new InvalidTupleVariationsError('invalid CVT variation array header');

  const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
  const limit = cvar.offset + cvar.length;
  const tuples = activeTuples(
    { bytes, headerAt: cvar.offset + 4, dataStart: cvar.offset, limit, sharedTuples, axisCount },
    normalized
  );

  const deltas = new Float64Array(controlValues.length);
  for (const { apply, points, deltasAt } of tuples) {
    if (!points) continue;
    const run = readPackedDeltas(
      bytes,
      deltasAt,
      limit,
      points === 'all' ? controlValues.length : points.length
    );
    if (!run) continue;
    for (let entry = 0; entry < run.deltas.length; entry++) {
      const index = points === 'all' ? entry : points[entry]!;
      if (index < controlValues.length) deltas[index]! += ftMulFix(run.deltas[entry]!, apply);
    }
  }
  return Int32Array.from(controlValues, (value, index) => value + fixedToFdot6(deltas[index]!));
}
