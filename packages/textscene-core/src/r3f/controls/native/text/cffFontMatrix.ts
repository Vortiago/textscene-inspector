/**
 * The `FontMatrix` of the Top DICT and of the font dicts of a CFF, the way FreeType reads and uses
 * it: `cff_parse_font_matrix` (cffparse.c) turns the operands into 16.16 entries and a units per em,
 * `cff_face_init` (cffobjs.c) normalises the matrix so that its `yy` is 1 and multiplies a font dict's
 * matrix with that of the Top DICT, and `cff_slot_load` (cffgload.c) scales a glyph by the ratio of
 * the two units per em and transforms its outline by the matrix.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { FIXED_16_16_ONE, ftDivFix, ftMulDiv, ftMulFix } from './fontMetrics';
import type { ScaledOutline } from './glyphContours';

/**
 * The matrix of a font dict. The entries are 16.16. The offset is whole units of the outline, which
 * FreeType adds to 26.6 coordinates. The units per em are those the entries leave out.
 */
export interface FontMatrix {
  readonly xx: number;
  readonly yx: number;
  readonly xy: number;
  readonly yy: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly unitsPerEm: number;
}

/**
 * A DICT's `FontMatrix` operator as the reader keeps it: the seven fields of a `FontMatrix`, in the
 * order the interface lists them, as `cff_parse_font_matrix` leaves them before it normalises them.
 */
export type FontMatrixEntry = readonly [number, number, number, number, number, number, number];

const POWER_TENS = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000];

/** The largest integer part of a 16.16 number. */
const MAX_FIXED_INTEGER = 0x7fff;

/** What `cff_parse_font_matrix` falls back to for values it finds unlikely. */
const UNLIKELY_ENTRY: FontMatrixEntry = [FIXED_16_16_ONE, 0, 0, FIXED_16_16_ONE, 0, 0, 1];

const REAL_OPERATOR = 30;
const END_OF_DATA = -1;

/** A number as a 16.16 value times a power of ten. */
interface ScaledNumber {
  readonly value: number;
  readonly scaling: number;
}

const ZERO_NUMBER: ScaledNumber = { value: 0, scaling: 0 };

/** Whether a read of `size` bytes at `at` crosses `limit`, which FreeType tests with `p + size > limit && limit >= p`. */
const crosses = (at: number, size: number, limit: number): boolean => at + size > limit && limit >= at;

/** `cff_parse_integer`: the integer whose first byte is at `at`, or 0 at the end of the data. */
function parseInteger(dv: DataView, at: number, limit: number): number {
  const first = dv.getUint8(at);
  const next = at + 1;
  if (first === 28) return crosses(next, 2, limit) ? 0 : dv.getInt16(next, false);
  if (first === 29) return crosses(next, 4, limit) ? 0 : dv.getInt32(next, false);
  if (first < 247) return first - 139;
  if (crosses(next, 1, limit)) return 0;
  const second = dv.getUint8(next);
  return first < 251 ? (first - 247) * 256 + second + 108 : -(first - 251) * 256 - second - 108;
}

/** `cff_parse_real` with a scaling: the real whose operator `30` is at `start`, as 16.16 and the power of ten left over. */
function parseScaledReal(dv: DataView, start: number, limit: number): ScaledNumber {
  let at = start;
  let phase = 4;
  const nextNibble = (): number => {
    if (phase) {
      at++;
      if (crosses(at, 1, limit)) return END_OF_DATA;
    }
    const nibble = (dv.getUint8(at) >> phase) & 0xf;
    phase = 4 - phase;
    return nibble;
  };

  let isNegative = false;
  let hasOverflow = false;
  let number = 0;
  let exponent = 0;
  let exponentAdd = 0;
  let integerLength = 0;
  let fractionLength = 0;

  let nibble = nextNibble();
  for (; nibble !== END_OF_DATA; nibble = nextNibble()) {
    if (nibble === 0xe) isNegative = true;
    else if (nibble > 9) break;
    else if (number >= 0xccccccc) exponentAdd++;
    else if (nibble || number) {
      integerLength++;
      number = number * 10 + nibble;
    }
  }
  if (nibble === 0xa) {
    for (nibble = nextNibble(); nibble !== END_OF_DATA && nibble < 10; nibble = nextNibble()) {
      if (!nibble && !number) exponentAdd--;
      else if (number < 0xccccccc && fractionLength < 9) {
        fractionLength++;
        number = number * 10 + nibble;
      }
    }
  }
  let isExponentNegative = false;
  if (nibble === 0xc) {
    isExponentNegative = true;
    nibble = 0xb;
  }
  if (nibble === 0xb) {
    for (nibble = nextNibble(); nibble !== END_OF_DATA && nibble < 10; nibble = nextNibble()) {
      if (exponent > 1000) hasOverflow = true;
      else exponent = exponent * 10 + nibble;
    }
    if (isExponentNegative) exponent = -exponent;
  }
  if (nibble === END_OF_DATA || !number) return ZERO_NUMBER;
  if (hasOverflow) return { value: isExponentNegative ? 0 : signed(0x7fffffff, isNegative), scaling: 0 };

  exponent += exponentAdd;
  fractionLength += integerLength;
  exponent += integerLength;
  if (fractionLength > 5) {
    const excess = fractionLength - 5;
    const isTooLarge = Math.trunc(number / POWER_TENS[excess]!) > MAX_FIXED_INTEGER;
    const digitsDropped = isTooLarge ? excess + 1 : excess;
    return {
      value: signed(ftDivFix(number, POWER_TENS[digitsDropped]!), isNegative),
      scaling: exponent - 5 + (isTooLarge ? 1 : 0),
    };
  }
  if (number > MAX_FIXED_INTEGER) {
    return { value: signed(ftDivFix(number, 10), isNegative), scaling: exponent - fractionLength + 1 };
  }
  if (exponent <= 0) {
    return { value: signed(number * FIXED_16_16_ONE, isNegative), scaling: exponent - fractionLength };
  }
  const newFractionLength = Math.min(exponent, 5);
  const shift = newFractionLength - fractionLength;
  if (shift <= 0) {
    return { value: signed(number * FIXED_16_16_ONE, isNegative), scaling: exponent - fractionLength };
  }
  number *= POWER_TENS[shift]!;
  exponent -= newFractionLength;
  if (number > MAX_FIXED_INTEGER) {
    number = Math.trunc(number / 10);
    exponent += 1;
  }
  return { value: signed(number * FIXED_16_16_ONE, isNegative), scaling: exponent };
}

const signed = (magnitude: number, isNegative: boolean): number => (isNegative ? -magnitude : magnitude);

/** `cff_parse_fixed_dynamic`: the integer or real at `at` as 16.16 and the power of ten left over. */
function parseFixedDynamic(dv: DataView, at: number, limit: number): ScaledNumber {
  if (dv.getUint8(at) === REAL_OPERATOR) return parseScaledReal(dv, at, limit);
  const number = parseInteger(dv, at, limit);
  if (number <= MAX_FIXED_INTEGER) return { value: number * FIXED_16_16_ONE, scaling: 0 };
  let integerLength = 5;
  while (integerLength < 10 && number >= POWER_TENS[integerLength]!) integerLength++;
  const isTooLarge = Math.trunc(number / POWER_TENS[integerLength - 5]!) > MAX_FIXED_INTEGER;
  const digitsDropped = isTooLarge ? integerLength - 4 : integerLength - 5;
  return { value: ftDivFix(number, POWER_TENS[digitsDropped]!), scaling: digitsDropped };
}

/** `FT_Matrix_Check`: whether the matrix is not degenerate, a test on its size and its determinant. */
function isUsableMatrix(xx: number, xy: number, yx: number, yy: number): boolean {
  const largest = Math.max(Math.abs(xx), Math.abs(xy), Math.abs(yx), Math.abs(yy));
  if (!largest || largest > 0x7fffffff) return false;
  const shift = 31 - Math.clz32(largest) - 12;
  if (shift > 0) {
    xx >>= shift;
    xy >>= shift;
    yx >>= shift;
    yy >>= shift;
  }
  return 32 * Math.abs(xx * yy - xy * yx) > xx * xx + xy * xy + yx * yx + yy * yy;
}

/** A value divided by a power of ten, rounded away from zero at the half. */
function roundedQuotient(value: number, divisor: number): number {
  const half = divisor >> 1;
  return Math.trunc((value < 0 ? value - half : value + half) / divisor);
}

/**
 * The `FontMatrix` whose six operands start at `operandStarts` in `dv`, or null for fewer than six.
 * Each operand is scaled by the power of ten that fits all six into 16.16, and the units per em
 * carry that power (`cff_parse_font_matrix`).
 */
export function readFontMatrixEntry(
  dv: DataView,
  operandStarts: readonly number[],
  limit: number
): FontMatrixEntry | null {
  if (operandStarts.length < 6) return null;
  const numbers = operandStarts.slice(0, 6).map((at) => parseFixedDynamic(dv, at, limit));
  const scalings = numbers.filter(({ value }) => value).map(({ scaling }) => scaling);
  const maxScaling = Math.max(...scalings);
  const minScaling = Math.min(...scalings);
  if (maxScaling < -9 || maxScaling > 0 || maxScaling - minScaling < 0 || maxScaling - minScaling > 9) {
    return UNLIKELY_ENTRY;
  }
  const [xx, yx, xy, yy, offsetX, offsetY] = numbers.map(({ value, scaling }) =>
    value ? roundedQuotient(value, POWER_TENS[maxScaling - scaling]!) : 0
  ) as [number, number, number, number, number, number];
  return isUsableMatrix(xx, xy, yx, yy)
    ? [xx, yx, xy, yy, offsetX, offsetY, POWER_TENS[-maxScaling]!]
    : UNLIKELY_ENTRY;
}

const IDENTITY_MATRIX = {
  xx: FIXED_16_16_ONE,
  yx: 0,
  xy: 0,
  yy: FIXED_16_16_ONE,
  offsetX: 0,
  offsetY: 0,
} as const;

function matrixOfEntry([xx, yx, xy, yy, offsetX, offsetY, unitsPerEm]: FontMatrixEntry): FontMatrix {
  return { xx, yx, xy, yy, offsetX, offsetY, unitsPerEm };
}

/**
 * The matrix with `yy` (`yx` if `yy` is 0) at 1, which moves the scale into the units per em, and
 * its offset in whole units. The shift of the offset is the one FreeType repeats for a font dict
 * that takes the matrix of the Top DICT, so that offset is 0, or -1 below zero.
 */
function normalised(matrix: FontMatrix): FontMatrix {
  const divisor = matrix.yy ? Math.abs(matrix.yy) : Math.abs(matrix.yx);
  const toWholeUnits = (offset: number) => Math.floor(offset / FIXED_16_16_ONE);
  if (divisor === FIXED_16_16_ONE) {
    return { ...matrix, offsetX: toWholeUnits(matrix.offsetX), offsetY: toWholeUnits(matrix.offsetY) };
  }
  return {
    xx: ftDivFix(matrix.xx, divisor),
    yx: ftDivFix(matrix.yx, divisor),
    xy: ftDivFix(matrix.xy, divisor),
    yy: ftDivFix(matrix.yy, divisor),
    offsetX: toWholeUnits(ftDivFix(matrix.offsetX, divisor)),
    offsetY: toWholeUnits(ftDivFix(matrix.offsetY, divisor)),
    unitsPerEm: ftDivFix(matrix.unitsPerEm, divisor),
  };
}

/** `top` times `sub` (`FT_Matrix_Multiply_Scaled`), and `sub`'s offset moved by `top`, both at the smaller units per em. */
function multiplied(top: FontMatrix, sub: FontMatrix): FontMatrix {
  const scaling = top.unitsPerEm > 1 && sub.unitsPerEm > 1 ? Math.min(top.unitsPerEm, sub.unitsPerEm) : 1;
  const unit = FIXED_16_16_ONE * scaling;
  const product = (a: number, b: number, c: number, d: number) => ftMulDiv(a, b, unit) + ftMulDiv(c, d, unit);
  return {
    xx: product(top.xx, sub.xx, top.xy, sub.yx),
    yx: product(top.yx, sub.xx, top.yy, sub.yx),
    xy: product(top.xx, sub.xy, top.xy, sub.yy),
    yy: product(top.yx, sub.xy, top.yy, sub.yy),
    offsetX: product(sub.offsetX, top.xx, sub.offsetY, top.xy),
    offsetY: product(sub.offsetX, top.yx, sub.offsetY, top.yy),
    unitsPerEm: ftMulDiv(sub.unitsPerEm, top.unitsPerEm, scaling),
  };
}

/** The matrices of a CFF as `cff_face_init` leaves them. `fontDicts` is null for a font with only a Top DICT. */
export interface FontMatrices {
  readonly top: FontMatrix;
  readonly fontDicts: readonly FontMatrix[] | null;
}

/**
 * The Top DICT's matrix and that of each font dict. A Top DICT without a matrix has the identity
 * with the `head` table's units per em. A font dict without a matrix takes the Top DICT's, and one
 * with a matrix is multiplied with the Top DICT's, if that has one.
 */
export function resolveFontMatrices(
  topEntry: FontMatrixEntry | undefined,
  fontDictEntries: readonly (FontMatrixEntry | undefined)[] | null,
  headUnitsPerEm: number
): FontMatrices {
  const top = normalised(
    topEntry ? matrixOfEntry(topEntry) : { ...IDENTITY_MATRIX, unitsPerEm: headUnitsPerEm }
  );
  const fontDictMatrix = (entry: FontMatrixEntry | undefined): FontMatrix => {
    if (!entry) return normalised(top);
    const own = matrixOfEntry(entry);
    return normalised(topEntry ? multiplied(top, own) : own);
  };
  return { top, fontDicts: fontDictEntries && fontDictEntries.map(fontDictMatrix) };
}

/**
 * The outline moved by `matrix` (`FT_Outline_Transform`, then `FT_Outline_Translate` by the
 * offset, which FreeType adds to 26.6 coordinates as it is), in place. The identity leaves it alone.
 */
export function transformOutline(outline: ScaledOutline, matrix: FontMatrix): void {
  const { xx, yx, xy, yy, offsetX, offsetY } = matrix;
  const { x, y } = outline;
  if (xx !== FIXED_16_16_ONE || yy !== FIXED_16_16_ONE || xy !== 0 || yx !== 0) {
    for (let i = 0; i < x.length; i++) {
      const px = x[i]!;
      const py = y[i]!;
      x[i] = ftMulFix(px, xx) + ftMulFix(py, xy);
      y[i] = ftMulFix(px, yx) + ftMulFix(py, yy);
    }
  }
  if (offsetX || offsetY) {
    for (let i = 0; i < x.length; i++) {
      x[i] = x[i]! + offsetX;
      y[i] = y[i]! + offsetY;
    }
  }
}
