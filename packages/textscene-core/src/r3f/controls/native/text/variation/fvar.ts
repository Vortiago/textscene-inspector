/**
 * The variation axes of a font (`fvar`), as FreeType lists them for `FT_Get_MM_Var`
 * (`ttgxvar.c`, `TT_Get_MM_Var`, validated in `sfobjs.c`, `sfnt_load_face`).
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { tableFits, type SfntFile } from '../sfntTables';

/** One axis: its tag as the 32-bit integer HarfBuzz makes of four characters, and its range in 16.16. */
export interface FvarAxis {
  readonly tag: number;
  readonly minimum: number;
  readonly defaultValue: number;
  readonly maximum: number;
}

const FVAR_HEADER_SIZE = 16;
const FVAR_VERSION = 0x00010000;
const AXIS_RECORD_SIZE = 20;
/** The axis count `sfnt_load_face` allows: a 16-bit instance size bounds it. */
const MAX_AXIS_COUNT = 0x3ffe;
/** The named-instance count `sfnt_load_face` allows: the name ids bound it. */
const MAX_INSTANCE_COUNT = 0x7eff;

/** The four characters of an axis tag, as `hb_tag_to_string` writes them. */
export function tagString(tag: number): string {
  return String.fromCharCode((tag >>> 24) & 0xff, (tag >>> 16) & 0xff, (tag >>> 8) & 0xff, tag & 0xff);
}

/**
 * The axes of the font, or null when FreeType does not take `fvar` for a variation font: a missing
 * table, a version other than 1.0, axes or named instances that the table does not hold.
 * An axis whose default lies outside its range is fixed to the default.
 */
export function readFvarAxes(sfnt: SfntFile): readonly FvarAxis[] | null {
  const { dv } = sfnt;
  const fvar = sfnt.tables.get('fvar');
  if (!fvar || !tableFits(dv, fvar, FVAR_HEADER_SIZE)) return null;
  const at = fvar.offset;
  const axesOffset = dv.getUint16(at + 4, false);
  const axisCount = dv.getUint16(at + 8, false);
  const axisSize = dv.getUint16(at + 10, false);
  const instanceCount = dv.getUint16(at + 12, false);
  const instanceSize = dv.getUint16(at + 14, false);
  const isValid =
    dv.getUint32(at, false) === FVAR_VERSION &&
    axisSize === AXIS_RECORD_SIZE &&
    axisCount > 0 &&
    axisCount <= MAX_AXIS_COUNT &&
    (instanceSize === 4 + 4 * axisCount || instanceSize === 6 + 4 * axisCount) &&
    instanceCount <= MAX_INSTANCE_COUNT &&
    axesOffset + AXIS_RECORD_SIZE * axisCount + instanceSize * instanceCount <= fvar.length;
  if (!isValid) return null;

  return Array.from({ length: axisCount }, (_, axis) => {
    const record = at + axesOffset + axis * AXIS_RECORD_SIZE;
    const minimum = dv.getInt32(record + 4, false);
    const defaultValue = dv.getInt32(record + 8, false);
    const maximum = dv.getInt32(record + 12, false);
    const tag = dv.getUint32(record, false);
    return minimum > defaultValue || defaultValue > maximum
      ? { tag, minimum: defaultValue, defaultValue, maximum: defaultValue }
      : { tag, minimum, defaultValue, maximum };
  });
}
