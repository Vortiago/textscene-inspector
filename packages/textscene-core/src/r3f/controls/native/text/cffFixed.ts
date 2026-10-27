/**
 * The 16.16 fixed-point helpers of FreeType's Adobe engine (`psfixed.h`) that hinting uses. A
 * charstring coordinate and a device-space position are both 16.16, so rounding and the
 * fractional part act on a multiple of 65536.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright 2007-2014 Adobe Systems Incorporated.
 * See THIRD-PARTY-NOTICES.md.
 */

import { FIXED_16_16_ONE } from './fontMetrics';

const HALF = FIXED_16_16_ONE / 2;

export function intToFixed(value: number): number {
  return value * FIXED_16_16_ONE;
}

/** `cf2_doubleToFixed`: rounded half up. */
export function doubleToFixed(value: number): number {
  return Math.floor(value * FIXED_16_16_ONE + 0.5);
}

/** `cf2_fixedRound`: the nearest whole number, half up. */
export function roundFixed(value: number): number {
  return Math.floor((value + HALF) / FIXED_16_16_ONE) * FIXED_16_16_ONE;
}

/** `cf2_fixedFraction`: what is left once the whole part, rounded down, is taken away. */
export function fractionOfFixed(value: number): number {
  return value - Math.floor(value / FIXED_16_16_ONE) * FIXED_16_16_ONE;
}

/** `FT_MulDiv`: `a * b / c`, rounded half up on the magnitude. A zero `c` gives the largest 32-bit value. */
export function ftMulDiv(a: number, b: number, c: number): number {
  if (c === 0) return 0x7fffffff;
  const sign = Math.sign(a) * Math.sign(b) * Math.sign(c);
  return sign * Math.floor((Math.abs(a) * Math.abs(b) + Math.floor(Math.abs(c) / 2)) / Math.abs(c));
}
