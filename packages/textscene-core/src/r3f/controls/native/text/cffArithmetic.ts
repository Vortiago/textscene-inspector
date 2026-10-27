/**
 * The arithmetic, storage and stack operators of a Type 2 charstring, the two-byte ones that
 * follow the escape byte 12. CFF2 dropped them, so a CFF2 charstring never reaches this module.
 * Numbers are 16.16 fixed-point as FreeType's interpreter (`psintrp.c`) computes them.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright 2007-2014 Adobe Systems Incorporated.
 * See THIRD-PARTY-NOTICES.md.
 */

import { FIXED_16_16_ONE, ftDivFix, ftMulFix } from './fontMetrics';
import type { OperandStack } from './cffOperandStack';

const FIXED_MAX = 0x7fffffff;

/** `CF2_STORAGE_SIZE`: the slots `put` and `get` address. */
const STORAGE_SIZE = 32;

/**
 * FreeType seeds `random` from a memory address, so Godot's value changes from run to run. This is
 * the seed FreeType falls back to when a font gives none: the same numbers on every run.
 */
const RANDOM_SEED = 987654321;

const ESCAPE_AND = 3;
const ESCAPE_OR = 4;
const ESCAPE_NOT = 5;
const ESCAPE_ABS = 9;
const ESCAPE_ADD = 10;
const ESCAPE_SUB = 11;
const ESCAPE_DIV = 12;
const ESCAPE_NEG = 14;
const ESCAPE_EQ = 15;
const ESCAPE_DROP = 18;
const ESCAPE_PUT = 20;
const ESCAPE_GET = 21;
const ESCAPE_IFELSE = 22;
const ESCAPE_RANDOM = 23;
const ESCAPE_MUL = 24;
const ESCAPE_SQRT = 26;
const ESCAPE_DUP = 27;
const ESCAPE_EXCH = 28;
const ESCAPE_INDEX = 29;
const ESCAPE_ROLL = 30;

/** The operators that pop two numbers and push the fixed-point number a function of them. */
const FIXED_BINARY = new Map<number, (first: number, second: number) => number>([
  [ESCAPE_ADD, (a, b) => (a + b) | 0],
  [ESCAPE_SUB, (a, b) => (a - b) | 0],
  [ESCAPE_DIV, (a, b) => ftDivFix(a, b) | 0],
  [ESCAPE_MUL, (a, b) => ftMulFix(a, b) | 0],
]);

/** The operators that pop two numbers and push the integer 1 for a true condition, else 0. */
const CONDITIONS = new Map<number, (first: number, second: number) => boolean>([
  [ESCAPE_AND, (a, b) => a !== 0 && b !== 0],
  [ESCAPE_OR, (a, b) => a !== 0 || b !== 0],
  [ESCAPE_EQ, (a, b) => a === b],
]);

/** `abs` and `neg` of the smallest number give the largest, as the negation has no 32-bit value. */
const FIXED_UNARY = new Map<number, (value: number) => number>([
  [ESCAPE_ABS, (a) => (a < -FIXED_MAX ? FIXED_MAX : Math.abs(a))],
  [ESCAPE_NEG, (a) => (a < -FIXED_MAX ? FIXED_MAX : -a)],
  [ESCAPE_SQRT, (a) => (a > 0 ? fixedSqrt(a) : 0)],
]);

/** `FT_SqrtFixed`: the square root of a positive 16.16 number, by the Babylonian method with rounded-up division. */
function fixedSqrt(value: number): number {
  const radicand = value * FIXED_16_16_ONE - 1;
  let estimate = 2 ** ((17 + (31 - Math.clz32(value))) >> 1);
  let previous: number;
  do {
    previous = estimate;
    estimate = (previous + Math.floor(radicand / previous) + 1) >>> 1;
  } while (estimate !== previous);
  return estimate;
}

/** `cff_random`: a 32-bit xorshift step. */
function nextRandom(state: number): number {
  let next = (state ^ (state << 13)) >>> 0;
  next = (next ^ (next >>> 17)) >>> 0;
  return (next ^ (next << 5)) >>> 0;
}

export class ArithmeticOperators {
  private readonly storage = new Array<number>(STORAGE_SIZE).fill(0);
  private randomState = RANDOM_SEED;

  constructor(private readonly stack: OperandStack) {}

  /** Runs the operator `12 op` and returns true, or returns false for an `op` that is not one of these. */
  run(op: number): boolean {
    const { stack } = this;
    const binary = FIXED_BINARY.get(op);
    if (binary) {
      const second = stack.popFixed();
      stack.pushFixed(binary(stack.popFixed(), second));
      return true;
    }
    const condition = CONDITIONS.get(op);
    if (condition) {
      const second = stack.popFixed();
      stack.pushInt(condition(stack.popFixed(), second) ? 1 : 0);
      return true;
    }
    const unary = FIXED_UNARY.get(op);
    if (unary) {
      stack.pushFixed(unary(stack.popFixed()));
      return true;
    }
    if (op === ESCAPE_NOT) {
      stack.pushInt(stack.popFixed() === 0 ? 1 : 0);
      return true;
    }
    return this.runStorageOrStack(op);
  }

  private runStorageOrStack(op: number): boolean {
    const { stack } = this;
    switch (op) {
      case ESCAPE_DROP:
        stack.popFixed();
        return true;
      case ESCAPE_PUT: {
        const slot = stack.popInt();
        const value = stack.popFixed();
        if (slot >= 0 && slot < STORAGE_SIZE) this.storage[slot] = value;
        return true;
      }
      case ESCAPE_GET: {
        const slot = stack.popInt();
        if (slot >= 0 && slot < STORAGE_SIZE) stack.pushFixed(this.storage[slot]!);
        return true;
      }
      case ESCAPE_IFELSE: {
        // `a b v1 v2 ifelse` leaves `a` when v1 <= v2, else `b`.
        const value2 = stack.popFixed();
        const value1 = stack.popFixed();
        const otherwise = stack.popFixed();
        const result = stack.popFixed();
        stack.pushFixed(value1 <= value2 ? result : otherwise);
        return true;
      }
      case ESCAPE_RANDOM:
        // Only the low 16 bits count, which makes a number in (0, 1].
        stack.pushFixed((this.randomState & 0xffff) + 1);
        this.randomState = nextRandom(this.randomState);
        return true;
      case ESCAPE_DUP: {
        const value = stack.popFixed();
        stack.pushFixed(value);
        stack.pushFixed(value);
        return true;
      }
      case ESCAPE_EXCH: {
        const top = stack.popFixed();
        const below = stack.popFixed();
        stack.pushFixed(top);
        stack.pushFixed(below);
        return true;
      }
      case ESCAPE_INDEX:
        this.index();
        return true;
      case ESCAPE_ROLL: {
        const shift = stack.popInt();
        stack.roll(stack.popInt(), shift);
        return true;
      }
      default:
        return false;
    }
  }

  /** `index`: copies the operand `distance` places below the top. A negative distance copies the top, one past the bottom the bottom. */
  private index(): void {
    const distance = this.stack.popInt();
    const { count } = this.stack;
    if (count === 0) return;
    const from = distance < 0 ? count - 1 : distance >= count ? 0 : count - 1 - distance;
    this.stack.pushFixed(this.stack.real(from));
  }
}
