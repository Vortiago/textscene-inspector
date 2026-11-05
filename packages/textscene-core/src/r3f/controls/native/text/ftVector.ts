/**
 * FreeType's vector arithmetic (`ftcalc.c` and `fttrigon.c`) that more than one port shares, kept
 * in its 32-bit fixed point: the embolden of an outline (`ftEmbolden.ts`), the TrueType
 * interpreter's unit vectors (`truetype/ttArithmetic.ts`), the scaled component offset of the
 * TrueType loader (`sfntGlyf.ts`) and the stroker's angles (`ftStroker.ts`).
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Vector2 } from '../../../../godot/math/vector';
import { toUint32 } from '../../../../godot/variant/intWidth';
import { FIXED_16_16_ONE, ftDivFix } from './fontMetrics';
import { highestBit } from './glyphContours';

/** The longer of two lengths plus half the shorter, `FT_Vector_NormLen`'s length estimate. */
function estimatedLength(x: number, y: number): number {
  return toUint32(x > y ? x + (y >>> 1) : y + (x >>> 1));
}

/**
 * `FT_Vector_NormLen`: scales `vector` to a 16.16 unit vector in place and returns its previous
 * length. A zero vector stays zero.
 *
 * @canonical FreeType's 16.16 unit vector of a vector, and its length
 */
export function ftVectorNormLen(vector: Vector2): number {
  const signX = vector.x < 0 ? -1 : 1;
  const signY = vector.y < 0 ? -1 : 1;
  let x = toUint32(Math.abs(vector.x));
  let y = toUint32(Math.abs(vector.y));

  if (x === 0) {
    if (y > 0) vector.y = signY * FIXED_16_16_ONE;
    return y;
  }
  if (y === 0) {
    if (x > 0) vector.x = signX * FIXED_16_16_ONE;
    return x;
  }

  // Prenormalise so that the estimated length lies between 2/3 and 4/3 of one.
  let length = estimatedLength(x, y);
  let shift = 31 - highestBit(length);
  shift -= 15 + (length >= 0xaaaaaaaa >>> shift ? 1 : 0);
  if (shift > 0) {
    x = toUint32(x << shift);
    y = toUint32(y << shift);
    length = estimatedLength(x, y);
  } else {
    x >>>= -shift;
    y >>>= -shift;
    length >>>= -shift;
  }

  let reciprocalMinusOne = FIXED_16_16_ONE - (length | 0);
  let u: number;
  let v: number;
  let step: number;
  do {
    u = toUint32((x | 0) + (Math.imul(x | 0, reciprocalMinusOne) >> 16));
    v = toUint32((y | 0) + (Math.imul(y | 0, reciprocalMinusOne) >> 16));
    step = Math.trunc(-((Math.imul(u, u) + Math.imul(v, v)) | 0) / 0x200);
    step = Math.trunc(Math.imul(step, (FIXED_16_16_ONE + reciprocalMinusOne) >> 8) / FIXED_16_16_ONE);
    reciprocalMinusOne += step;
  } while (step > 0);

  vector.x = signX < 0 ? -u : u;
  vector.y = signY < 0 ? -v : v;

  const norm = toUint32(
    FIXED_16_16_ONE + Math.trunc(((Math.imul(u, x) + Math.imul(v, y)) | 0) / FIXED_16_16_ONE)
  );
  return shift > 0 ? toUint32(norm + (1 << (shift - 1))) >>> shift : toUint32(norm << -shift);
}

/** `FT_TRIG_SCALE`: the CORDIC shrink factor, 0.858785336480436 in 0.32. */
const TRIG_SCALE = 0xdbd95b16n;
/** `FT_TRIG_SAFE_MSB`: the highest bit of a component that no pseudo-rotation overflows. */
const TRIG_SAFE_MSB = 29;
/** `FT_TRIG_MAX_ITERS`: the pseudo-rotations, one fewer than the iterations it counts. */
const TRIG_MAX_ITERS = 23;

/** `x >> shift` on an `FT_Fixed` that may pass 32 bits, which `>>` would wrap. */
const shiftRight = (value: number, shift: number): number => Math.floor(value / 2 ** shift);

/** `ft_trig_downscale`: the magnitude times the shrink factor, rounded, with the sign kept. Exact in 64 bits. */
function trigDownscale(value: number): number {
  const magnitude = Number((BigInt(Math.abs(value)) * TRIG_SCALE + 0x40000000n) >> 32n);
  return value < 0 ? -magnitude : magnitude;
}

/** `FT_ANGLE_PI` and its parts: an `FT_Angle` is 16.16 degrees. */
export const ANGLE_PI = 180 * FIXED_16_16_ONE;
export const ANGLE_PI2 = ANGLE_PI / 2;
const ANGLE_PI4 = ANGLE_PI / 4;
const ANGLE_2PI = ANGLE_PI * 2;

/** `ft_trig_arctan_table`: the angle of each CORDIC pseudo-rotation, in 16.16 degrees. */
const ARCTAN_TABLE = [
  1740967, 919879, 466945, 234379, 117304, 58666, 29335, 14668, 7334, 3667, 1833, 917, 458, 229, 115, 57, 29,
  14, 7, 4, 2, 1,
];

/**
 * `ft_trig_prenorm`: scales `vector` in place so that its larger component's highest bit is the
 * safe one, and returns the shift, negative for a scale down.
 */
function trigPrenorm(vector: Vector2): number {
  const highest = highestBit(toUint32(Math.abs(vector.x) | Math.abs(vector.y)));
  if (highest <= TRIG_SAFE_MSB) {
    const shift = TRIG_SAFE_MSB - highest;
    vector.x *= 2 ** shift;
    vector.y *= 2 ** shift;
    return shift;
  }
  const shift = highest - TRIG_SAFE_MSB;
  vector.x = shiftRight(vector.x, shift);
  vector.y = shiftRight(vector.y, shift);
  return -shift;
}

/** `ft_trig_pseudo_rotate`: rotates `vector` by `theta` in place by CORDIC, scaled by its gain. */
function pseudoRotate(vector: Vector2, angle: number): void {
  let { x, y } = vector;
  let theta = angle;
  while (theta < -ANGLE_PI4) {
    [x, y] = [y, -x];
    theta += ANGLE_PI2;
  }
  while (theta > ANGLE_PI4) {
    [x, y] = [-y, x];
    theta -= ANGLE_PI2;
  }
  for (let i = 1, bias = 1; i < TRIG_MAX_ITERS; bias *= 2, i++) {
    const towards = theta < 0 ? -1 : 1;
    const nextX = x - towards * shiftRight(y + bias, i);
    y += towards * shiftRight(x + bias, i);
    x = nextX;
    theta -= towards * ARCTAN_TABLE[i - 1]!;
  }
  vector.x = x;
  vector.y = y;
}

/**
 * `ft_trig_pseudo_polarize`: the length of a prenormed vector, still scaled by the CORDIC gain, and
 * its angle rounded to 1/16 degree, from rotating it onto the positive x axis.
 */
function pseudoPolarise(vectorX: number, vectorY: number): { length: number; angle: number } {
  let x = vectorX;
  let y = vectorY;
  let theta = 0;
  if (y > x) {
    if (y > -x) [theta, x, y] = [ANGLE_PI2, y, -x];
    else [theta, x, y] = [y > 0 ? ANGLE_PI : -ANGLE_PI, -x, -y];
  } else if (y < -x) [theta, x, y] = [-ANGLE_PI2, -y, x];
  for (let i = 1, bias = 1; i < TRIG_MAX_ITERS; bias *= 2, i++) {
    const towards = y > 0 ? 1 : -1;
    const nextX = x + towards * shiftRight(y + bias, i);
    y -= towards * shiftRight(x + bias, i);
    x = nextX;
    theta += towards * ARCTAN_TABLE[i - 1]!;
  }
  // `FT_PAD_ROUND(theta, 16)`: the table's rounding errors gather in the low bits.
  const rounded = Math.floor((Math.abs(theta) + 8) / 16) * 16;
  return { length: x, angle: theta >= 0 ? rounded : -rounded };
}

/**
 * `FT_Vector_Length`: the length of `vector`, by CORDIC (`fttrigon.c`), as `FT_Hypot` returns it.
 *
 * @canonical FreeType's CORDIC length of a vector, FT_Hypot
 */
export function ftVectorLength({ x, y }: Vector2): number {
  if (x === 0) return Math.abs(y);
  if (y === 0) return Math.abs(x);
  // `ft_trig_prenorm`: scale so that the larger component's highest bit is the safe one.
  const highest = highestBit(toUint32(Math.abs(x) | Math.abs(y)));
  const shift = TRIG_SAFE_MSB - highest;
  const scaled = (value: number) => (shift >= 0 ? value * 2 ** shift : shiftRight(value, -shift));
  const length = trigDownscale(pseudoPolarise(scaled(x), scaled(y)).length);
  if (shift > 0) return shiftRight(length + 2 ** (shift - 1), shift);
  return toUint32(length * 2 ** -shift);
}

/** `FT_Atan2`: the angle of the vector `(dx, dy)` in 16.16 degrees, 0 for a zero vector. */
export function ftAtan2(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  const vector = { x: dx, y: dy };
  trigPrenorm(vector);
  return pseudoPolarise(vector.x, vector.y).angle;
}

/** `FT_Vector_Unit`: the 16.16 unit vector at `angle`. */
export function ftVectorUnit(angle: number): Vector2 {
  const vector = { x: Number(TRIG_SCALE >> 8n), y: 0 };
  pseudoRotate(vector, angle);
  return { x: shiftRight(vector.x + 0x80, 8), y: shiftRight(vector.y + 0x80, 8) };
}

/** `FT_Cos`: the 16.16 cosine of `angle`. */
export const ftCos = (angle: number): number => ftVectorUnit(angle).x;

/** `FT_Sin`: the 16.16 sine of `angle`. */
export const ftSin = (angle: number): number => ftVectorUnit(angle).y;

/** `FT_Tan`: the 16.16 tangent of `angle`. */
export function ftTan(angle: number): number {
  const vector = { x: 1 << 24, y: 0 };
  pseudoRotate(vector, angle);
  return ftDivFix(vector.y, vector.x);
}

/** `FT_Vector_Rotate`: `vector` turned by `angle`, rounded half away from zero on a scale down. */
export function ftVectorRotate(vector: Readonly<Vector2>, angle: number): Vector2 {
  if (angle === 0 || (vector.x === 0 && vector.y === 0)) return { x: vector.x, y: vector.y };
  const rotated = { x: vector.x, y: vector.y };
  const shift = trigPrenorm(rotated);
  pseudoRotate(rotated, angle);
  const x = trigDownscale(rotated.x);
  const y = trigDownscale(rotated.y);
  if (shift > 0) {
    const half = 2 ** (shift - 1);
    return {
      x: shiftRight(x + half - (x < 0 ? 1 : 0), shift),
      y: shiftRight(y + half - (y < 0 ? 1 : 0), shift),
    };
  }
  return { x: x * 2 ** -shift, y: y * 2 ** -shift };
}

/** `FT_Vector_From_Polar`: the vector `length` long at `angle`. */
export const ftVectorFromPolar = (length: number, angle: number): Vector2 =>
  ftVectorRotate({ x: length, y: 0 }, angle);

/** `FT_Angle_Diff`: the turn from `angle1` to `angle2`, in (-180, 180] degrees. */
export function ftAngleDiff(angle1: number, angle2: number): number {
  let delta = angle2 - angle1;
  while (delta <= -ANGLE_PI) delta += ANGLE_2PI;
  while (delta > ANGLE_PI) delta -= ANGLE_2PI;
  return delta;
}
