/**
 * Reads the six operands of a DICT's `FontMatrix` the way `cff_parse_font_matrix` (cffparse.c) does.
 * It keeps every operand as a 16.16 number times a power of ten, so that a matrix of small reals
 * such as 0.001 keeps its digits. It then brings the six to one power of ten, which becomes the
 * units per em of the matrix.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { identityFontMatrix, type FontMatrix } from './cffFontMatrix';
import { FIXED_16_16_ONE, ftDivFix, ftMulDiv } from './fontMetrics';

/** The largest integer part of a 16.16 number. */
const MAX_FIXED_INTEGER = 0x7fff;

/** Past this, another digit would overflow the 32-bit number FreeType accumulates: it counts a power of ten instead. */
const DIGIT_LIMIT = 0xccccccc;

/** FreeType keeps at most nine digits after the point, and gives up on an exponent beyond 1000 (`cff_parse_real`). */
const MAX_FRACTION_DIGITS = 9;
const MAX_EXPONENT = 1000;

/** The powers of ten that `cff_parse_font_matrix` accepts for its largest operand, and the spread between the largest and the smallest. */
const MIN_LARGEST_SCALING = -9;
const MAX_SCALING_SPREAD = 9;

const REAL_OPERATOR = 30;
const END_OF_DATA = -1;

/** A number as a 16.16 value times a power of ten. */
interface ScaledNumber {
  readonly value: number;
  readonly scaling: number;
}

const ZERO_NUMBER: ScaledNumber = { value: 0, scaling: 0 };

const powerOfTen = (exponent: number): number => 10 ** exponent;

const signed = (magnitude: number, isNegative: boolean): number => (isNegative ? -magnitude : magnitude);

/** Whether a read of `size` bytes at `at` crosses `limit`, which FreeType tests with `p + size > limit && limit >= p`. */
const crosses = (at: number, size: number, limit: number): boolean => at + size > limit && limit >= at;

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
    else if (number >= DIGIT_LIMIT) exponentAdd++;
    else if (nibble || number) {
      integerLength++;
      number = number * 10 + nibble;
    }
  }
  if (nibble === 0xa) {
    for (nibble = nextNibble(); nibble !== END_OF_DATA && nibble < 10; nibble = nextNibble()) {
      if (!nibble && !number) exponentAdd--;
      else if (number < DIGIT_LIMIT && fractionLength < MAX_FRACTION_DIGITS) {
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
      if (exponent > MAX_EXPONENT) hasOverflow = true;
      else exponent = exponent * 10 + nibble;
    }
    if (isExponentNegative) exponent = -exponent;
  }
  if (nibble === END_OF_DATA || !number) return ZERO_NUMBER;
  if (hasOverflow) return { value: isExponentNegative ? 0 : signed(0x7fffffff, isNegative), scaling: 0 };

  return scaledReal(
    number,
    exponent + exponentAdd + integerLength,
    fractionLength + integerLength,
    isNegative
  );
}

/** The digits `number`, with `fractionLength` of them after the point and a power of ten of `exponent`, as 16.16 and a power of ten. */
function scaledReal(
  number: number,
  exponent: number,
  fractionLength: number,
  isNegative: boolean
): ScaledNumber {
  if (fractionLength > 5) {
    const excess = fractionLength - 5;
    const isTooLarge = Math.trunc(number / powerOfTen(excess)) > MAX_FIXED_INTEGER;
    const digitsDropped = isTooLarge ? excess + 1 : excess;
    return {
      value: signed(ftDivFix(number, powerOfTen(digitsDropped)), isNegative),
      scaling: exponent - 5 + (isTooLarge ? 1 : 0),
    };
  }
  if (number > MAX_FIXED_INTEGER) {
    return { value: signed(ftDivFix(number, 10), isNegative), scaling: exponent - fractionLength + 1 };
  }
  // Make the power of ten as small as possible: move up to five digits of it into the number.
  const shift = Math.min(exponent, 5) - fractionLength;
  if (shift <= 0) {
    return { value: signed(number * FIXED_16_16_ONE, isNegative), scaling: exponent - fractionLength };
  }
  const shifted = number * powerOfTen(shift);
  const isTooLargeNow = shifted > MAX_FIXED_INTEGER;
  return {
    value: signed((isTooLargeNow ? Math.trunc(shifted / 10) : shifted) * FIXED_16_16_ONE, isNegative),
    scaling: exponent - Math.min(exponent, 5) + (isTooLargeNow ? 1 : 0),
  };
}

/** The integer `operand` of a DICT as 16.16 and the power of ten left over (`cff_parse_fixed_dynamic`). */
function scaledInteger(operand: number): ScaledNumber {
  if (operand <= MAX_FIXED_INTEGER) return { value: operand * FIXED_16_16_ONE, scaling: 0 };
  let integerLength = 5;
  while (integerLength < 10 && operand >= powerOfTen(integerLength)) integerLength++;
  const isTooLarge = Math.trunc(operand / powerOfTen(integerLength - 5)) > MAX_FIXED_INTEGER;
  const digitsDropped = isTooLarge ? integerLength - 4 : integerLength - 5;
  return { value: ftDivFix(operand, powerOfTen(digitsDropped)), scaling: digitsDropped };
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

/**
 * The `FontMatrix` whose `operands` start at `operandStarts` in `dv`, as written in the DICT, or
 * null for fewer than six operands. FreeType falls back to the identity, with one unit per em,
 * for operands that differ by more than nine powers of ten, exceed 16.16, or have no determinant.
 */
export function readFontMatrix(
  dv: DataView,
  operands: readonly number[],
  operandStarts: readonly number[],
  limit: number
): FontMatrix | null {
  if (operands.length < 6) return null;
  const numbers = operands
    .slice(0, 6)
    .map((operand, i) =>
      dv.getUint8(operandStarts[i]!) === REAL_OPERATOR
        ? parseScaledReal(dv, operandStarts[i]!, limit)
        : scaledInteger(operand)
    );
  const scalings = numbers.filter(({ value }) => value).map(({ scaling }) => scaling);
  if (scalings.length === 0) return identityFontMatrix(1);
  const maxScaling = Math.max(...scalings);
  if (
    maxScaling < MIN_LARGEST_SCALING ||
    maxScaling > 0 ||
    maxScaling - Math.min(...scalings) > MAX_SCALING_SPREAD
  ) {
    return identityFontMatrix(1);
  }
  const [xx, yx, xy, yy, offsetX, offsetY] = numbers.map(({ value, scaling }) =>
    ftMulDiv(value, 1, powerOfTen(maxScaling - scaling))
  ) as [number, number, number, number, number, number];
  return isUsableMatrix(xx, xy, yx, yy)
    ? { xx, yx, xy, yy, offsetX, offsetY, unitsPerEm: powerOfTen(-maxScaling) }
    : identityFontMatrix(1);
}
