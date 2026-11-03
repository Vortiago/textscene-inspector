/**
 * The fixed-point arithmetic of FreeType's TrueType interpreter (`ttinterp.c`, `ftobjs.h`): 26.6
 * distances, 2.14 unit vectors, and the C casts an instruction applies to a stack value. The pixel
 * rounding of 26.6 values (`FT_PIX_*`) lives in `fontMetrics.ts`, as the loader rounds with it too. A stack
 * value is FreeType's 64-bit `FT_Long`, which a double holds exactly at every size a font reaches.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { toInt16 } from '../../../../../godot/variant/intWidth';
import { ftVectorNormLen } from '../ftVector';

/** One in 2.14, the length of a unit vector along an axis. */
export const F2DOT14_ONE = 0x4000;

/** The 2.14 rounding of `TT_MulFix14` and `TT_DotFix14`: half up, and half less below zero (`ab >> 63`). */
function roundedShift14(product: number): number {
  return Math.floor((product + 0x2000 - (product < 0 ? 1 : 0)) / F2DOT14_ONE);
}

/** `TT_MulFix14`: a 26.6 value times a 2.14 factor. */
export function mulFix14(value: number, factor: number): number {
  return roundedShift14(value * factor);
}

/** `TT_DotFix14`: the dot product of a 26.6 vector and a 2.14 unit vector. */
export function dotFix14(ax: number, ay: number, bx: number, by: number): number {
  return roundedShift14(ax * bx + ay * by);
}

/** `FT_MulDiv_No_Round`: `a * b / c` truncated toward zero, or the largest 32-bit magnitude for a zero `c`. */
export function mulDivNoRound(a: number, b: number, c: number): number {
  const isNegative = (a < 0 !== b < 0) !== c < 0;
  const magnitude = c === 0 ? 0x7fffffff : Math.floor((Math.abs(a) * Math.abs(b)) / Math.abs(c));
  return isNegative ? -magnitude : magnitude;
}

/** `BOUNDSL( value, count )`: true for a value an unsigned cast puts outside `0 .. count - 1`. */
export function isOutside(value: number, count: number): boolean {
  return value < 0 || value >= count;
}

/** A 2.14 unit vector. */
export interface UnitVector {
  readonly x: number;
  readonly y: number;
}

/**
 * `Normalize`: the 2.14 unit vector along `(x, y)`, through `FT_Vector_NormLen` on the 32-bit
 * values and a division by 4 that truncates. Null for the zero vector, which leaves the vector
 * the instruction sets as it was.
 */
export function unitVectorAlong(x: number, y: number): UnitVector | null {
  if (x === 0 && y === 0) return null;
  const vector = { x: x | 0, y: y | 0 };
  ftVectorNormLen(vector);
  return { x: toInt16(Math.trunc(vector.x / 4)), y: toInt16(Math.trunc(vector.y / 4)) };
}
