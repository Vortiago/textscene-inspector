/**
 * `frexp` and `ldexp` as composites: `frexp` splits a float's bits with integer operations, and
 * `ldexp` scales by exact powers of two.
 */

import {
  add,
  bitAnd,
  bitOr,
  clamp,
  div,
  equal,
  floatBitsToUint,
  int,
  mul,
  select,
  shiftLeft,
  shiftRight,
  sub,
  uint,
  uintBitsToFloat,
} from 'three/tsl';
import type { Node } from 'three/webgpu';
import {
  byLane,
  chained,
  type Composite,
  intNode,
  laneOf,
  lanesOf,
  tsl,
  unsignedNode,
  withScalar,
} from './compositeParts.js';
import { convertedNode } from './emitConstant.js';
import { topBitOf } from './integerComposites.js';

const EXPONENT_MASK = 0x7f800000;
const FRACTION_MASK = 0x007fffff;
const SIGN_MASK = 0x80000000;
const HALF_EXPONENT = 0x3f000000;
const FRACTION_BITS = 23;
/** frexp's exponent of a normal float is its biased exponent less this. */
const HALF_BIAS = 126;
/** frexp's exponent of a subnormal is the index of its top fraction bit less this. */
const SUBNORMAL_BIAS = 148;
const FLOAT_BIAS = 127;
/** Past these, every finite non-zero x gives 0 or an infinity. */
const LDEXP_LOWEST = -278;
const LDEXP_HIGHEST = 277;

const isInfiniteOrNaN = (bits: Node) =>
  tsl(equal)(tsl(bitAnd)(bits, unsignedNode(EXPONENT_MASK)), unsignedNode(EXPONENT_MASK));

// Integer operations only, so a GPU that flushes subnormals still splits one.
function split(x: Node): { fraction: Node; exponent: Node } {
  const bits = tsl(floatBitsToUint)(x);
  const fractionBits = tsl(bitAnd)(bits, unsignedNode(FRACTION_MASK));
  const biased = tsl(int)(
    tsl(shiftRight)(tsl(bitAnd)(bits, unsignedNode(EXPONENT_MASK)), unsignedNode(FRACTION_BITS))
  );
  const isSubnormal = tsl(equal)(biased, intNode(0));
  const isZero = chained(isSubnormal).and(tsl(equal)(fractionBits, unsignedNode(0)));
  const top = topBitOf(fractionBits, 'uint');
  const shift = tsl(uint)(tsl(sub)(intNode(FRACTION_BITS), top));
  const normalised = tsl(select)(
    isSubnormal,
    tsl(bitAnd)(tsl(shiftLeft)(fractionBits, shift), unsignedNode(FRACTION_MASK)),
    fractionBits
  );
  const halfBits = tsl(bitOr)(
    tsl(bitOr)(tsl(bitAnd)(bits, unsignedNode(SIGN_MASK)), normalised),
    unsignedNode(HALF_EXPONENT)
  );
  const exponent = tsl(select)(
    isSubnormal,
    tsl(sub)(top, intNode(SUBNORMAL_BIAS)),
    tsl(sub)(biased, intNode(HALF_BIAS))
  );
  // GLSL leaves infinity and NaN undefined: x itself, as C's frexp and Godot's driver give.
  const keepsX = chained(isZero).or(isInfiniteOrNaN(bits));
  return {
    fraction: tsl(select)(keepsX, x, tsl(uintBitsToFloat)(halfBits)),
    exponent: tsl(select)(isZero, intNode(0), exponent),
  };
}

const frexp: Composite = ([x, exponent], [type, exponentType]) => {
  const parts = Array.from({ length: lanesOf(type!) }, (_, index) => split(laneOf(x!, type!, index)));
  chained(exponent!).assign(byLane(exponentType!, (index) => parts[index]!.exponent));
  return byLane(type!, (index) => parts[index]!.fraction);
};

// Exact for -126 <= k <= 127.
const powerOfTwo = (k: Node, type: string) =>
  tsl(uintBitsToFloat)(
    tsl(shiftLeft)(
      convertedNode(tsl(add)(k, intNode(FLOAT_BIAS)), type, withScalar(type, 'uint')),
      unsignedNode(FRACTION_BITS)
    )
  );

// Three normal powers of two span the clamp.
const ldexp: Composite = ([x, exponent], [, exponentType]) => {
  const whole = tsl(clamp)(exponent!, intNode(LDEXP_LOWEST), intNode(LDEXP_HIGHEST));
  const first = tsl(div)(whole, intNode(3));
  const second = tsl(div)(tsl(sub)(whole, first), intNode(2));
  const third = tsl(sub)(tsl(sub)(whole, first), second);
  return [first, second, third].reduce((product, k) => tsl(mul)(product, powerOfTwo(k, exponentType!)), x!);
};

export const EXPONENT_COMPOSITES: Readonly<Record<string, Composite>> = { frexp, ldexp };
