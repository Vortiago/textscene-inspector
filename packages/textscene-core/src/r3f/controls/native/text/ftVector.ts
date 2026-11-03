/**
 * FreeType's vector arithmetic (`ftcalc.c` and `fttrigon.c`) that more than one port shares, kept
 * in its 32-bit fixed point: the embolden of an outline (`ftEmbolden.ts`), the TrueType
 * interpreter's unit vectors (`truetype/ttArithmetic.ts`) and the scaled component offset of the
 * TrueType loader (`sfntGlyf.ts`).
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Vector2 } from '../../../../godot/math/vector';
import { toUint32 } from '../../../../godot/variant/intWidth';
import { FIXED_16_16_ONE } from './fontMetrics';
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

/**
 * `ft_trig_pseudo_polarize`, for its length alone: the x of the vector rotated onto the positive
 * x axis by CORDIC pseudo-rotations, still scaled by their gain.
 */
function pseudoPolarisedLength(vectorX: number, vectorY: number): number {
  let x = vectorX;
  let y = vectorY;
  if (y > x) [x, y] = y > -x ? [y, -x] : [-x, -y];
  else if (y < -x) [x, y] = [-y, x];
  for (let i = 1, bias = 1; i < TRIG_MAX_ITERS; bias *= 2, i++) {
    const towardsAxis = y > 0 ? 1 : -1;
    const nextX = x + towardsAxis * shiftRight(y + bias, i);
    y -= towardsAxis * shiftRight(x + bias, i);
    x = nextX;
  }
  return x;
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
  const length = trigDownscale(pseudoPolarisedLength(scaled(x), scaled(y)));
  if (shift > 0) return shiftRight(length + 2 ** (shift - 1), shift);
  return toUint32(length * 2 ** -shift);
}
