/**
 * `Math::atan2` on `real_t` operands (`math_funcs.h:124-126`), which an official build hands to the
 * `atan2f` of the C library. This is the `atan2f` of glibc 2.39, the library the reference Godot
 * links: it misses the correctly rounded angle by one bit for about one input in nine, and a
 * chain that folds onto one line bends to the side that bit picks.
 *
 * Ported from the GNU C Library (`sysdeps/ieee754/flt-32/e_atan2f.c`, `s_atanf.c`), which carries:
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 * Developed at SunPro, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this software is freely granted, provided that
 * this notice is preserved. See THIRD-PARTY-NOTICES.md.
 */

// Bound once, not read from `Math` per call: see `real.ts`.
const { fround: f, abs } = Math;

const word = new DataView(new ArrayBuffer(4));

/** The bits of a float as a signed 32-bit integer, which the C source calls its word. */
function floatWord(value: number): number {
  word.setFloat32(0, value);
  return word.getInt32(0);
}

const SIGN_CLEARED = 0x7fffffff;
const INFINITY_WORD = 0x7f800000;
const ONE_WORD = 0x3f800000;

/** The high and low parts of atan(0.5), atan(1), atan(1.5) and atan(inf). */
const ATAN_HIGH = [4.6364760399e-1, 7.8539812565e-1, 9.8279368877e-1, 1.5707962513].map(f);
const ATAN_LOW = [5.012158244e-9, 3.7748947079e-8, 3.447321717e-8, 7.5497894159e-8].map(f);

/** The coefficients of the odd polynomial that approximates atan on the reduced argument. */
const ATAN_TERMS = [
  3.3333334327e-1, -2.0000000298e-1, 1.4285714924e-1, -1.1111110449e-1, 9.0908870101e-2, -7.6918758452e-2,
  6.6610731184e-2, -5.8335702866e-2, 4.9768779427e-2, -3.6531571299e-2, 1.6285819933e-2,
].map(f);

const PI = f(3.141592741);
const HALF_PI = f(1.5707963705);
const QUARTER_PI = f(7.8539818525e-1);
/** The part of pi that `PI` rounds away. */
const PI_LOW = f(-8.7422776573e-8);

/** The index of the table entry `__atanf` measures an argument of this magnitude from, or -1 below 0.4375. */
function tableOf(magnitudeWord: number): number {
  if (magnitudeWord < 0x3ee00000) return -1;
  if (magnitudeWord < 0x3f300000) return 0;
  if (magnitudeWord < 0x3f980000) return 1;
  return magnitudeWord < 0x401c0000 ? 2 : 3;
}

/** The argument of `__atanf` as it is measured from the table entry at `table`. */
function reduced(x: number, table: number): number {
  if (table < 0) return x;
  const size = abs(x);
  if (table === 0) return f(f(f(2 * size) - 1) / f(2 + size));
  if (table === 1) return f(f(size - 1) / f(size + 1));
  if (table === 2) return f(f(size - 1.5) / f(1 + f(1.5 * size)));
  return f(-1 / size);
}

/** `__atanf`: each step rounds to float, in the order the C source writes it. */
function atanFloat(x: number): number {
  const xWord = floatWord(x);
  const magnitudeWord = xWord & SIGN_CLEARED;
  if (magnitudeWord > INFINITY_WORD) return NaN;
  // At 2^25 and above the answer is a quarter turn.
  if (magnitudeWord >= 0x4c000000)
    return xWord > 0 ? f(ATAN_HIGH[3]! + ATAN_LOW[3]!) : f(-ATAN_HIGH[3]! - ATAN_LOW[3]!);
  // Below 2^-29 the angle is its own tangent.
  if (magnitudeWord < 0x31000000) return x;
  // Two numbers, not one object for both: a solve asks for an angle in every pass of every chain.
  const table = tableOf(magnitudeWord);
  const argument = reduced(x, table);
  const t = ATAN_TERMS;
  const z = f(argument * argument);
  const w = f(z * z);
  const odd = f(
    z * f(t[0]! + f(w * f(t[2]! + f(w * f(t[4]! + f(w * f(t[6]! + f(w * f(t[8]! + f(w * t[10]!))))))))))
  );
  const even = f(w * f(t[1]! + f(w * f(t[3]! + f(w * f(t[5]! + f(w * f(t[7]! + f(w * t[9]!)))))))));
  const correction = f(argument * f(odd + even));
  if (table < 0) return f(argument - correction);
  const angle = f(ATAN_HIGH[table]! - f(f(correction - ATAN_LOW[table]!) - argument));
  return xWord < 0 ? -angle : angle;
}

/** The answer where one operand is zero or infinite. `quadrant` holds the sign of y in bit 0 and of x in bit 1. */
function specialAngle(y: number, xMagnitude: number, yMagnitude: number, quadrant: number): number | null {
  const isXNegative = quadrant >= 2;
  const isYNegative = (quadrant & 1) === 1;
  if (yMagnitude === 0) return isXNegative ? (isYNegative ? -PI : PI) : y;
  if (xMagnitude === 0 || (yMagnitude === INFINITY_WORD && xMagnitude !== INFINITY_WORD)) {
    return isYNegative ? -HALF_PI : HALF_PI;
  }
  if (xMagnitude !== INFINITY_WORD) return null;
  const size =
    yMagnitude !== INFINITY_WORD ? (isXNegative ? PI : 0) : isXNegative ? f(3 * QUARTER_PI) : QUARTER_PI;
  return isYNegative ? -size : size;
}

/**
 * The angle of the vector (x, y) as Godot computes it on `real_t` operands.
 *
 * @canonical The atan2 of two real_t operands, bit for bit as the reference Godot
 */
export function atan2Real(y: number, x: number): number {
  const xWord = floatWord(f(x));
  const yWord = floatWord(f(y));
  const xMagnitude = xWord & SIGN_CLEARED;
  const yMagnitude = yWord & SIGN_CLEARED;
  if (xMagnitude > INFINITY_WORD || yMagnitude > INFINITY_WORD) return NaN;
  if (xWord === ONE_WORD) return atanFloat(f(y));
  const quadrant = ((yWord >> 31) & 1) | ((xWord >> 30) & 2);
  const special = specialAngle(f(y), xMagnitude, yMagnitude, quadrant);
  if (special !== null) return special;
  // The exponents of y and x: past 2^60 apart the quotient is a quarter turn or nothing.
  const exponentGap = (yMagnitude - xMagnitude) >> 23;
  let angle: number;
  if (exponentGap > 60) angle = f(HALF_PI + f(0.5 * PI_LOW));
  else if (xWord < 0 && exponentGap < -60) angle = 0;
  else angle = atanFloat(abs(f(f(y) / f(x))));
  if (quadrant === 0) return angle;
  if (quadrant === 1) return -angle;
  return quadrant === 2 ? f(PI - f(angle - PI_LOW)) : f(f(angle - PI_LOW) - PI);
}
