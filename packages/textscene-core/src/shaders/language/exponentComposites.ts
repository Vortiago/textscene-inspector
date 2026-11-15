import {
  add,
  bitAnd,
  bitOr,
  clamp,
  convert,
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
import { byLane, chained, type Composite, laneOf, tsl, withScalar } from './compositeParts.js';
import { floatNode } from './emitConstant.js';

const unsignedNode = (value: number) => uint(value) as unknown as Node;
const intNode = (value: number) => int(value) as unknown as Node;

const EXPONENT_MASK = 0x7f800000;
const SIGN_AND_FRACTION = 0x807fffff;
const HALF_EXPONENT = 0x3f000000;
const SUBNORMAL_SCALE = 32;

const isInfiniteOrNaN = (bits: Node) =>
  tsl(equal)(tsl(bitAnd)(bits, unsignedNode(EXPONENT_MASK)), unsignedNode(EXPONENT_MASK));

function split(x: Node): { fraction: Node; exponent: Node } {
  const isZero = tsl(equal)(x, floatNode(0));
  const isSubnormal = tsl(equal)(
    tsl(bitAnd)(tsl(floatBitsToUint)(x), unsignedNode(EXPONENT_MASK)),
    unsignedNode(0)
  );
  const normal = tsl(select)(isSubnormal, tsl(mul)(x, floatNode(2 ** SUBNORMAL_SCALE)), x);
  const bits = tsl(floatBitsToUint)(normal);
  const biased = tsl(int)(tsl(bitAnd)(tsl(shiftRight)(bits, unsignedNode(23)), unsignedNode(0xff)));
  const scale = tsl(select)(isSubnormal, intNode(126 + SUBNORMAL_SCALE), intNode(126));
  const halfBits = tsl(bitOr)(
    tsl(bitAnd)(bits, unsignedNode(SIGN_AND_FRACTION)),
    unsignedNode(HALF_EXPONENT)
  );
  // GLSL leaves infinity and NaN undefined: x itself, as C's frexp and Godot's driver give.
  const keepsX = chained(isZero).or(isInfiniteOrNaN(bits));
  return {
    fraction: tsl(select)(keepsX, x, tsl(uintBitsToFloat)(halfBits)),
    exponent: tsl(select)(isZero, intNode(0), tsl(sub)(biased, scale)),
  };
}

const frexp: Composite = ([x, exponent], [type, exponentType]) => {
  const lanes = (part: 'fraction' | 'exponent', laneType: string) =>
    byLane(laneType, (index) => split(laneOf(x!, type!, index))[part]);
  chained(exponent!).assign(lanes('exponent', exponentType!));
  return lanes('fraction', type!);
};

// Exact for -126 <= k <= 127.
const powerOfTwo = (k: Node, type: string) =>
  tsl(uintBitsToFloat)(
    tsl(shiftLeft)(
      tsl(convert)(tsl(add)(k, intNode(127)), withScalar(type, 'uint') as never),
      unsignedNode(23)
    )
  );

// Two normal powers keep a subnormal result exact. Past the clamp, every result overflows or is 0.
const ldexp: Composite = ([x, exponent], [, exponentType]) => {
  const whole = tsl(clamp)(exponent!, intNode(-252), intNode(254));
  const half = tsl(shiftRight)(whole, intNode(1));
  const rest = tsl(sub)(whole, half);
  return tsl(mul)(tsl(mul)(x!, powerOfTwo(half, exponentType!)), powerOfTwo(rest, exponentType!));
};

export const EXPONENT_COMPOSITES: Readonly<Record<string, Composite>> = { frexp, ldexp };
