/**
 * glslang's arithmetic on constant lanes (`Constant.cpp` and `ConstantUnion.h` of the glslang Godot
 * 4.6.3 ships), as the x86-64 build of Godot computes it. A float lane is a double, an `int` lane
 * a 32-bit signed integer, a `uint` lane a 32-bit unsigned one, and a `bool` lane a boolean.
 */

import { INT32_MAX, INT32_MIN, toInt32, toUint32, UINT32_MAX } from '../../godot/variant/intWidth.js';
import { godotIntScalar, godotUintScalar } from './godotNumber.js';
import type { Scalar } from './shaderTree.js';
import type { ScalarKind } from './types.js';

/** One lane of a binary operator. */
type LaneOperation = (a: Scalar, b: Scalar) => Scalar;

/** The lane `value` of kind `from` as kind `to`: the C++ casts of glslang's `EOpConv` folds. */
export function convertedLane(value: Scalar, from: ScalarKind, to: ScalarKind): Scalar {
  if (from === to) return value;
  if (to === 'bool') return value !== 0 && value !== false;
  const number = typeof value === 'boolean' ? Number(value) : value;
  if (to === 'float') return number;
  if (from === 'float') return to === 'int' ? godotIntScalar(number) : godotUintScalar(number);
  return to === 'int' ? toInt32(number) : toUint32(number);
}

/** The lane of a unary operator on a lane of kind `scalar`, or nothing for one glslang leaves. */
export function unaryLane(op: string, scalar: ScalarKind, a: Scalar): Scalar | undefined {
  if (op === 'OP_NOT') return !a;
  if (op === 'OP_NEGATE') return wrapped(scalar, -(a as number));
  if (op === 'OP_BIT_INVERT') return wrapped(scalar, ~(a as number));
  return undefined;
}

/** The lane operation of `op` on lanes of kind `scalar`, or nothing for one glslang leaves. */
export function binaryLane(op: string, scalar: ScalarKind): LaneOperation | undefined {
  const arithmetic = ARITHMETIC[op];
  if (arithmetic) return (a, b) => arithmetic(scalar, a as number, b as number);
  return LOGIC[op];
}

/** An integer result as its kind holds it: the low 32 bits, signed for `int`. */
function wrapped(scalar: ScalarKind, value: number): number {
  if (scalar === 'int') return toInt32(value);
  return scalar === 'uint' ? toUint32(value) : value;
}

type Arithmetic = (scalar: ScalarKind, a: number, b: number) => number;

/** A shift count is taken modulo 32, as the x86-64 shift instruction does. */
const ARITHMETIC: Readonly<Record<string, Arithmetic>> = {
  OP_ADD: (scalar, a, b) => wrapped(scalar, a + b),
  OP_SUB: (scalar, a, b) => wrapped(scalar, a - b),
  OP_MUL: (scalar, a, b) => (scalar === 'float' ? a * b : wrapped(scalar, Math.imul(a, b))),
  OP_DIV: divided,
  OP_MOD: remainder,
  OP_SHIFT_LEFT: (scalar, a, b) => wrapped(scalar, a << b),
  OP_SHIFT_RIGHT: (scalar, a, b) => (scalar === 'int' ? a >> b : a >>> b),
  OP_BIT_AND: (scalar, a, b) => wrapped(scalar, a & b),
  OP_BIT_OR: (scalar, a, b) => wrapped(scalar, a | b),
  OP_BIT_XOR: (scalar, a, b) => wrapped(scalar, a ^ b),
};

/** `EOpDiv` (`Constant.cpp:148`): a division by zero gives a fixed value, not a trap. */
function divided(scalar: ScalarKind, a: number, b: number): number {
  if (scalar === 'float') {
    if (b !== 0) return a / b;
    if (a === 0 || Number.isNaN(a)) return NaN;
    return a > 0 ? Infinity : -Infinity;
  }
  if (b === 0) return scalar === 'int' ? INT32_MAX : UINT32_MAX;
  if (scalar === 'int' && a === INT32_MIN && b === -1) return INT32_MIN;
  return wrapped(scalar, Math.trunc(a / b));
}

/** `EOpMod`: a modulo by zero gives the left lane, and the least `int` modulo -1 gives zero. */
function remainder(scalar: ScalarKind, a: number, b: number): number {
  if (b === 0) return a;
  if (scalar === 'int' && a === INT32_MIN && b === -1) return 0;
  return wrapped(scalar, a % b);
}

/**
 * The comparisons and logic glslang folds. `<=` is `!(a > b)` and `>=` is `!(a < b)`, so each
 * holds for a NaN lane.
 */
const LOGIC: Readonly<Record<string, LaneOperation>> = {
  OP_LESS: (a, b) => a < b,
  OP_GREATER: (a, b) => a > b,
  OP_LESS_EQUAL: (a, b) => !(a > b),
  OP_GREATER_EQUAL: (a, b) => !(a < b),
  OP_AND: (a, b) => (a as boolean) && (b as boolean),
  OP_OR: (a, b) => (a as boolean) || (b as boolean),
};
