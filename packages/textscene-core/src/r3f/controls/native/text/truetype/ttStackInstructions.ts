/**
 * The TrueType instructions that push, reorder and compute stack values (`ttinterp.c`, `Ins_PUSHB`
 * to `Ins_ROLL`, the arithmetic and the logic). Each takes the stack index `a` of its first
 * argument, and leaves its results from there.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ftMulDiv } from '../fontMetrics';
import { toInt16 } from '../../../../../godot/variant/intWidth';
import { mulDivNoRound, pixCeil, pixFloor } from './ttArithmetic';
import type { ExecContext } from './ttExecContext';

/** Whether `count` more values would overflow the stack (`BOUNDS( L, stackSize + 1 - top )`). */
function overflowsStack(exc: ExecContext, count: number): boolean {
  return count >= exc.stack.length + 1 - exc.top;
}

/** The signed word at `at` of the instruction stream. */
function wordAt(code: Uint8Array, at: number): number {
  return toInt16((code[at]! << 8) | code[at + 1]!);
}

/**
 * Pushes `count` values of `bytesEach` bytes that start after `countByte` stream bytes, and leaves
 * the instruction pointer on the last byte read (`Ins_NPUSHB`, `Ins_PUSHB` and the word forms).
 */
function pushFromStream(
  exc: ExecContext,
  a: number,
  count: number,
  bytesEach: 1 | 2,
  countBytes: 0 | 1
): boolean {
  const ip = exc.ip + countBytes;
  if (ip + bytesEach * count >= exc.code.length) return exc.fail('Code_Overflow');
  if (overflowsStack(exc, count)) return exc.fail('Stack_Overflow');
  for (let k = 0; k < count; k++) {
    const at = ip + 1 + bytesEach * k;
    exc.stack[a + k] = bytesEach === 1 ? exc.code[at]! : wordAt(exc.code, at);
  }
  exc.ip = ip + bytesEach * count;
  return true;
}

/** NPUSHB and NPUSHW: the count follows the opcode, and the values grow the stack past its push count. */
export function pushCounted(exc: ExecContext, a: number): void {
  if (exc.ip + 1 >= exc.code.length) {
    exc.fail('Code_Overflow');
    return;
  }
  const count = exc.code[exc.ip + 1]!;
  if (pushFromStream(exc, a, count, exc.opcode === 0x40 ? 1 : 2, 1)) exc.newTop += count;
}

/** PUSHB[n] and PUSHW[n]: n + 1 values. */
export function pushFixed(exc: ExecContext, a: number): void {
  const isWords = exc.opcode >= 0xb8;
  pushFromStream(exc, a, exc.opcode - (isWords ? 0xb8 : 0xb0) + 1, isWords ? 2 : 1, 0);
}

export function duplicate(exc: ExecContext, a: number): void {
  exc.stack[a + 1] = exc.stack[a]!;
}

export function clear(exc: ExecContext): void {
  exc.newTop = 0;
}

export function swap(exc: ExecContext, a: number): void {
  const { stack } = exc;
  [stack[a], stack[a + 1]] = [stack[a + 1]!, stack[a]!];
}

export function depth(exc: ExecContext, a: number): void {
  exc.stack[a] = exc.top;
}

/** CINDEX: a copy of the value `L` below; 0 for an index past the stack. */
export function copyIndexed(exc: ExecContext, a: number): void {
  const index = exc.stack[a]!;
  exc.stack[a] = index <= 0 || index > exc.args ? 0 : exc.stack[a - index]!;
}

/** MINDEX: the value `L` below moves to the top; an index past the stack does nothing. */
export function moveIndexed(exc: ExecContext, a: number): void {
  const index = exc.stack[a]!;
  if (index <= 0 || index > exc.args) return;
  const moved = exc.stack[a - index]!;
  exc.stack.copyWithin(a - index, a - index + 1, a);
  exc.stack[a - 1] = moved;
}

/** ROLL: the third value moves to the top. */
export function roll(exc: ExecContext, a: number): void {
  const { stack } = exc;
  const [c, b, top] = [stack[a]!, stack[a + 1]!, stack[a + 2]!];
  stack[a + 2] = c;
  stack[a + 1] = top;
  stack[a] = b;
}

/** A binary instruction that sets its first argument from both. */
function binary(operation: (left: number, right: number) => number): (exc: ExecContext, a: number) => void {
  return (exc, a) => {
    exc.stack[a] = operation(exc.stack[a]!, exc.stack[a + 1]!);
  };
}

/** A unary instruction that sets its argument from itself. */
function unary(operation: (value: number) => number): (exc: ExecContext, a: number) => void {
  return (exc, a) => {
    exc.stack[a] = operation(exc.stack[a]!);
  };
}

const asNumber = (condition: boolean): number => (condition ? 1 : 0);

export const lessThan = binary((left, right) => asNumber(left < right));
export const lessThanOrEqual = binary((left, right) => asNumber(left <= right));
export const greaterThan = binary((left, right) => asNumber(left > right));
export const greaterThanOrEqual = binary((left, right) => asNumber(left >= right));
export const equal = binary((left, right) => asNumber(left === right));
export const notEqual = binary((left, right) => asNumber(left !== right));
export const and = binary((left, right) => asNumber(left !== 0 && right !== 0));
export const or = binary((left, right) => asNumber(left !== 0 || right !== 0));
export const not = unary((value) => asNumber(value === 0));
export const add = binary((left, right) => left + right);
export const subtract = binary((left, right) => left - right);
export const multiply = binary((left, right) => ftMulDiv(left, right, 64));
export const absolute = unary(Math.abs);
export const negate = unary((value) => 0 - value);
export const floor = unary(pixFloor);
export const ceiling = unary(pixCeil);
export const maximum = binary(Math.max);
export const minimum = binary(Math.min);

/** DIV: a 26.6 quotient that truncates, or an error for a zero divisor. */
export function divide(exc: ExecContext, a: number): void {
  const divisor = exc.stack[a + 1]!;
  if (divisor === 0) exc.fail('Divide_By_Zero');
  else exc.stack[a] = mulDivNoRound(exc.stack[a]!, 64, divisor);
}

/** ODD and EVEN: whether the value, rounded in the current state, is an odd or even pixel. */
export function isOdd(exc: ExecContext, a: number): void {
  exc.stack[a] = asNumber((exc.round(exc.stack[a]!) & 64) === 64);
}

export function isEven(exc: ExecContext, a: number): void {
  exc.stack[a] = asNumber((exc.round(exc.stack[a]!) & 64) === 0);
}
