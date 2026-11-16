/**
 * Ported from the GNU C Library (`sysdeps/ieee754/flt-32/e_acosf.c`), which carries:
 * Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
 * Developed at SunPro, a Sun Microsystems, Inc. business.
 * Permission to use, copy, modify, and distribute this software is freely granted, provided that
 * this notice is preserved. See THIRD-PARTY-NOTICES.md.
 */

import { floatOfWord, floatWord } from './floatBits.js';

const f = Math.fround;

const PI = f(3.1415925026);
const HALF_PI_HIGH = f(1.5707962513);
const HALF_PI_LOW = f(7.5497894159e-8);
const P = [
  1.6666667163e-1, -3.2556581497e-1, 2.0121252537e-1, -4.0055535734e-2, 7.9153501429e-4, 3.4793309169e-5,
].map(f);
const Q = [-2.4033949375, 2.0209457874, -6.8828397989e-1, 7.7038154006e-2].map(f);

/** `p / q`, the rational part of `__ieee754_acosf` at `z`, each step rounded to float. */
function rational(z: number): number {
  const p = f(
    z * f(P[0]! + f(z * f(P[1]! + f(z * f(P[2]! + f(z * f(P[3]! + f(z * f(P[4]! + f(z * P[5]!))))))))))
  );
  const q = f(1 + f(z * f(Q[0]! + f(z * f(Q[1]! + f(z * f(Q[2]! + f(z * Q[3]!))))))));
  return f(p / q);
}

/**
 * `acosf` of glibc 2.39 on a float, NaN past ±1.
 *
 * @canonical A float32 arc cosine as glibc rounds it
 */
export function acosReal(x: number): number {
  const bits = floatWord(x);
  const magnitude = bits & 0x7fffffff;
  if (magnitude === 0x3f800000) return bits > 0 ? 0 : f(PI + f(2 * HALF_PI_LOW));
  if (magnitude > 0x3f800000) return NaN;
  if (magnitude < 0x3f000000) {
    if (magnitude <= 0x32800000) return f(HALF_PI_HIGH + HALF_PI_LOW);
    const r = rational(f(x * x));
    return f(HALF_PI_HIGH - f(x - f(HALF_PI_LOW - f(x * r))));
  }
  if (bits < 0) {
    const z = f(f(1 + x) * 0.5);
    const s = f(Math.sqrt(z));
    const w = f(f(rational(z) * s) - HALF_PI_LOW);
    return f(PI - f(2 * f(s + w)));
  }
  const z = f(f(1 - x) * 0.5);
  const s = f(Math.sqrt(z));
  const high = floatOfWord(floatWord(s) & 0xfffff000);
  const c = f(f(z - f(high * high)) / f(s + high));
  const w = f(f(rational(z) * s) + c);
  return f(2 * f(high + w));
}
