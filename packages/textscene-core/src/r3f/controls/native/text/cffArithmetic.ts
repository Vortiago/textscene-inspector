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
  private readonly operators: ReadonlyMap<number, () => void>;

  constructor(private readonly stack: OperandStack) {
    this.operators = new Map<number, () => void>([
      [ESCAPE_ADD, () => this.fixedBinary((a, b) => a + b)],
      [ESCAPE_SUB, () => this.fixedBinary((a, b) => a - b)],
      [ESCAPE_DIV, () => this.fixedBinary(ftDivFix)],
      [ESCAPE_MUL, () => this.fixedBinary(ftMulFix)],
      [ESCAPE_AND, () => this.condition((a, b) => a !== 0 && b !== 0)],
      [ESCAPE_OR, () => this.condition((a, b) => a !== 0 || b !== 0)],
      [ESCAPE_EQ, () => this.condition((a, b) => a === b)],
      [ESCAPE_NOT, () => stack.pushInt(stack.popFixed() === 0 ? 1 : 0)],
      // `abs` and `neg` of the smallest number give the largest, as the negation has no 32-bit value.
      [ESCAPE_ABS, () => this.fixedUnary((a) => (a < -FIXED_MAX ? FIXED_MAX : Math.abs(a)))],
      [ESCAPE_NEG, () => this.fixedUnary((a) => (a < -FIXED_MAX ? FIXED_MAX : -a))],
      [ESCAPE_SQRT, () => this.fixedUnary((a) => (a > 0 ? fixedSqrt(a) : 0))],
      [ESCAPE_DROP, () => void stack.popFixed()],
      [ESCAPE_PUT, () => this.put()],
      [ESCAPE_GET, () => this.get()],
      [ESCAPE_IFELSE, () => this.ifElse()],
      [ESCAPE_RANDOM, () => this.random()],
      [ESCAPE_DUP, () => this.dup()],
      [ESCAPE_EXCH, () => this.exchange()],
      [ESCAPE_INDEX, () => this.index()],
      [ESCAPE_ROLL, () => stack.roll(...this.rollOperands())],
    ]);
  }

  /** Runs the operator `12 op` and returns true, or returns false for an `op` that is not one of these. */
  run(op: number): boolean {
    const operator = this.operators.get(op);
    operator?.();
    return operator !== undefined;
  }

  /** Pops two numbers and pushes the fixed-point number `combine` makes of them, wrapped to 32 bits. */
  private fixedBinary(combine: (first: number, second: number) => number): void {
    const second = this.stack.popFixed();
    this.stack.pushFixed(combine(this.stack.popFixed(), second) | 0);
  }

  /** Pops two numbers and pushes the integer 1 for a true condition, else 0. */
  private condition(holds: (first: number, second: number) => boolean): void {
    const second = this.stack.popFixed();
    this.stack.pushInt(holds(this.stack.popFixed(), second) ? 1 : 0);
  }

  private fixedUnary(apply: (value: number) => number): void {
    this.stack.pushFixed(apply(this.stack.popFixed()));
  }

  private put(): void {
    const slot = this.stack.popInt();
    const value = this.stack.popFixed();
    if (slot >= 0 && slot < STORAGE_SIZE) this.storage[slot] = value;
  }

  private get(): void {
    const slot = this.stack.popInt();
    if (slot >= 0 && slot < STORAGE_SIZE) this.stack.pushFixed(this.storage[slot]!);
  }

  /** `a b v1 v2 ifelse` leaves `a` when v1 <= v2, else `b`. */
  private ifElse(): void {
    const value2 = this.stack.popFixed();
    const value1 = this.stack.popFixed();
    const otherwise = this.stack.popFixed();
    const result = this.stack.popFixed();
    this.stack.pushFixed(value1 <= value2 ? result : otherwise);
  }

  /** Only the low 16 bits count, which makes a number in (0, 1]. */
  private random(): void {
    this.stack.pushFixed((this.randomState & 0xffff) + 1);
    this.randomState = nextRandom(this.randomState);
  }

  private dup(): void {
    const value = this.stack.popFixed();
    this.stack.pushFixed(value);
    this.stack.pushFixed(value);
  }

  private exchange(): void {
    const top = this.stack.popFixed();
    const below = this.stack.popFixed();
    this.stack.pushFixed(top);
    this.stack.pushFixed(below);
  }

  /** The operands of `roll`, popped in the order the shift sits above the count. */
  private rollOperands(): [count: number, shift: number] {
    const shift = this.stack.popInt();
    return [this.stack.popInt(), shift];
  }

  /**
   * `index`: copies the operand `distance` places below the top. A negative distance copies the top,
   * one past the bottom the bottom.
   */
  private index(): void {
    const distance = this.stack.popInt();
    const { count } = this.stack;
    if (count === 0) return;
    this.stack.pushFixed(this.stack.real(count - 1 - Math.min(Math.max(distance, 0), count - 1)));
  }
}
