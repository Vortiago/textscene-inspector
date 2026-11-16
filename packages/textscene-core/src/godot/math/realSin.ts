/**
 * Ported from Arm Optimized Routines (`math/sinf.c`, `math/cosf.c`, `math/sincosf.h` and
 * `math/sincosf_data.c`), which carry:
 * Copyright (c) 2018-2024, Arm Limited.
 * SPDX-License-Identifier: MIT OR Apache-2.0 WITH LLVM-exception
 * See THIRD-PARTY-NOTICES.md.
 */

import { floatWord } from './floatBits.js';

const f = Math.fround;

const absTop12 = (x: number) => (floatWord(x) >>> 20) & 0x7ff;

const PI_63 = (2 * Math.PI) / 2 ** 64;
const PI_OVER_4_TOP = absTop12(0.7853981852531433);
const TINY_TOP = absTop12(0.000244140625);
const FAST_LIMIT_TOP = absTop12(120);
const INFINITY_TOP = absTop12(Infinity);
const HALF_PI_INVERSE_SCALED = 10680707.430881744;
const HALF_PI = Math.PI / 2;
const QUADRANT_SIGN = [1, -1, -1, 1];

interface Polynomial {
  readonly c0: number;
  readonly c1: number;
  readonly c2: number;
  readonly c3: number;
  readonly c4: number;
  readonly s1: number;
  readonly s2: number;
  readonly s3: number;
}

const SINE = { s1: -0.16666654943701084, s2: 0.008332178146138854, s3: -0.00019517298981385725 };
const COSINE: Polynomial = {
  c0: 1,
  c1: -0.49999999725108224,
  c2: 0.041666623324344516,
  c3: -0.001388676379437604,
  c4: 2.4390450703564542e-5,
  ...SINE,
};
// The second table negates the cosine polynomial, for quadrants 2 and 3.
const NEGATED_COSINE: Polynomial = {
  c0: -1,
  c1: 0.49999999725108224,
  c2: -0.041666623324344516,
  c3: 0.001388676379437604,
  c4: -2.4390450703564542e-5,
  ...SINE,
};

// 4/π to 192 bits, eight new bits an entry.
const INVERSE_PI_OVER_4 = [
  0xa2, 0xa2f9, 0xa2f983, 0xa2f9836e, 0xf9836e4e, 0x836e4e44, 0x6e4e4415, 0x4e441529, 0x441529fc, 0x1529fc27,
  0x29fc2757, 0xfc2757d1, 0x2757d1f5, 0x57d1f534, 0xd1f534dd, 0xf534ddc0, 0x34ddc0db, 0xddc0db62, 0xc0db6295,
  0xdb629599, 0x6295993c, 0x95993c43, 0x993c4390, 0x3c439041,
];

const SPLITTER = 2 ** 27 + 1;

/** `a * b + c` with the product's error kept: it equals glibc's fused build for every float operand. */
function fusedMultiplyAdd(a: number, b: number, c: number): number {
  let t = SPLITTER * a;
  const aHigh = t - (t - a);
  const aLow = a - aHigh;
  t = SPLITTER * b;
  const bHigh = t - (t - b);
  const bLow = b - bHigh;
  const product = a * b;
  const productError = aHigh * bHigh - product + aHigh * bLow + aLow * bHigh + aLow * bLow;
  const sum = product + c;
  const virtual = sum - product;
  const sumError = product - (sum - virtual) + (c - virtual);
  return sum + (sumError + productError);
}

/** `sinf_poly`: the sine polynomial at `x` for an even quadrant, the cosine one for an odd. */
function polynomial(x: number, x2: number, p: Polynomial, quadrant: number): number {
  if ((quadrant & 1) === 0) {
    const x3 = x * x2;
    const s1 = fusedMultiplyAdd(x2, p.s3, p.s2);
    const x7 = x3 * x2;
    return f(fusedMultiplyAdd(x7, s1, fusedMultiplyAdd(x3, p.s1, x)));
  }
  const x4 = x2 * x2;
  const c2 = fusedMultiplyAdd(x2, p.c4, p.c3);
  const c1 = fusedMultiplyAdd(x2, p.c1, p.c0);
  const x6 = x4 * x2;
  return f(fusedMultiplyAdd(x6, c2, fusedMultiplyAdd(x4, p.c2, c1)));
}

interface Reduced {
  readonly x: number;
  readonly quadrant: number;
  /** The quadrant that picks the sign and the table: a large negative operand adds one to it. */
  readonly signQuadrant: number;
}

/** `reduce_fast`: one multiply-subtract of π/2, accurate below 120. */
function reduceFast(x: number): Reduced {
  const quadrant = (((x * HALF_PI_INVERSE_SCALED) | 0) + 0x800000) >> 24;
  return { x: fusedMultiplyAdd(-quadrant, HALF_PI, x), quadrant, signQuadrant: quadrant };
}

const MASK_64 = (1n << 64n) - 1n;

/** `reduce_large`: the exact fixed-point product of the mantissa and 4/π, with a 64-bit wrap. */
function reduceLarge(bits: number): Omit<Reduced, 'signQuadrant'> {
  const at = (bits >>> 26) & 15;
  const shifted = (((bits & 0xffffff) | 0x800000) << ((bits >>> 23) & 7)) >>> 0;
  const low = BigInt(Math.imul(shifted, INVERSE_PI_OVER_4[at]!) >>> 0);
  const middle = BigInt(shifted) * BigInt(INVERSE_PI_OVER_4[at + 4]!);
  const high = BigInt(shifted) * BigInt(INVERSE_PI_OVER_4[at + 8]!);
  let fraction = (((high >> 32n) | (low << 32n)) + middle) & MASK_64;
  const quadrant = ((fraction + (1n << 61n)) & MASK_64) >> 62n;
  fraction = (fraction - (quadrant << 62n)) & MASK_64;
  return { x: Number(BigInt.asIntN(64, fraction)) * PI_63, quadrant: Number(quadrant) };
}

function reduce(y: number): Reduced {
  if (absTop12(y) < FAST_LIMIT_TOP) return reduceFast(y);
  const bits = floatWord(y);
  const { x, quadrant } = reduceLarge(bits);
  return { x, quadrant, signQuadrant: quadrant + (bits >>> 31) };
}

/** `sinf_poly` on a reduced angle, signed and tabled by its sign quadrant. */
function reducedPolynomial({ x, signQuadrant }: Reduced, quadrant: number): number {
  const table = signQuadrant & 2 ? NEGATED_COSINE : COSINE;
  return polynomial(x * QUADRANT_SIGN[signQuadrant & 3]!, x * x, table, quadrant);
}

/**
 * `sinf` of glibc 2.39 with fused multiply-adds, on a float. NaN for an infinite or NaN operand.
 *
 * @canonical A float32 sine or cosine as glibc rounds it
 */
export function sinReal(y: number): number {
  const top = absTop12(y);
  if (top < PI_OVER_4_TOP) return top < TINY_TOP ? y : polynomial(y, y * y, COSINE, 0);
  if (top >= INFINITY_TOP) return NaN;
  const reduced = reduce(y);
  return reducedPolynomial(reduced, reduced.quadrant);
}

/**
 * `cosf` of glibc 2.39 with fused multiply-adds, on a float. NaN for an infinite or NaN operand.
 *
 * @canonical A float32 sine or cosine as glibc rounds it
 */
export function cosReal(y: number): number {
  const top = absTop12(y);
  if (top < PI_OVER_4_TOP) return top < TINY_TOP ? 1 : polynomial(y, y * y, COSINE, 1);
  if (top >= INFINITY_TOP) return NaN;
  const reduced = reduce(y);
  return reducedPolynomial(reduced, reduced.quadrant ^ 1);
}
