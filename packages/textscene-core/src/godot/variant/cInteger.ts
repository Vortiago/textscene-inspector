import { INT32_MIN, toInt32 } from './intWidth.js';

export const INT64_MAX = (1n << 63n) - 1n;
export const INT64_MIN = -(1n << 63n);

const { fround } = Math;
const FLOAT_MANTISSA_BITS = 24;
const INT64_RANGE = 2 ** 63;
const INT32_RANGE = 2 ** 31;

/** A division x86-64 refuses with SIGFPE, which ends Godot. */
export class GodotCrash extends Error {}

export function wrapInt64(value: bigint): bigint {
  return BigInt.asIntN(64, value);
}

export function wrapInt32(value: bigint | number): number {
  return typeof value === 'bigint' ? Number(BigInt.asIntN(32, value)) : toInt32(value);
}

/**
 * `(int64_t)` of a double: cvttsd2si truncates, and gives the lowest integer for NaN or a value out of range.
 *
 * @canonical The C cast of a double to int64_t
 */
export function doubleToInt64(value: number): bigint {
  const whole = Math.trunc(value);
  return whole >= -INT64_RANGE && whole < INT64_RANGE ? BigInt(whole) : INT64_MIN;
}

/**
 * `(int32_t)` of a double, with the same lowest integer for NaN or a value out of range.
 *
 * @canonical The C cast of a double to int32_t
 */
export function doubleToInt32(value: number): number {
  const whole = Math.trunc(value);
  return whole >= -INT32_RANGE && whole < INT32_RANGE ? whole | 0 : INT32_MIN;
}

/** cvtsi2ss: the int64 rounded once to the nearest float, ties to even. */
export function int64ToFloat32(value: bigint): number {
  const magnitude = value < 0n ? -value : value;
  const shift = magnitude.toString(2).length - FLOAT_MANTISSA_BITS;
  if (shift <= 0) return fround(Number(value));
  const unit = 1n << BigInt(shift);
  let kept = magnitude >> BigInt(shift);
  const rest = magnitude & (unit - 1n);
  const half = unit >> 1n;
  if (rest > half || (rest === half && (kept & 1n) === 1n)) kept += 1n;
  const rounded = Number(kept) * 2 ** shift;
  return value < 0n ? -rounded : rounded;
}

/** C's `/` on integers: truncation toward zero, and SIGFPE for the one quotient out of range. */
export function divideInt64(left: bigint, right: bigint): bigint {
  if (left === INT64_MIN && right === -1n) throw new GodotCrash('int64 division overflow');
  return left / right;
}

export function remainderInt64(left: bigint, right: bigint): bigint {
  if (left === INT64_MIN && right === -1n) throw new GodotCrash('int64 remainder overflow');
  return left % right;
}

export function divideInt32(left: number, right: number): number {
  if (right === 0) throw new GodotCrash('int32 division by zero');
  if (left === INT32_MIN && right === -1) throw new GodotCrash('int32 division overflow');
  return Math.trunc(left / right) | 0;
}

export function remainderInt32(left: number, right: number): number {
  if (right === 0) throw new GodotCrash('int32 remainder by zero');
  if (left === INT32_MIN && right === -1) throw new GodotCrash('int32 remainder overflow');
  return (left % right) | 0;
}
