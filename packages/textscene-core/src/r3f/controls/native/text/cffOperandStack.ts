/**
 * The operand stack of a Type 2 charstring, typed the way FreeType's `CF2_Stack` types it: an
 * operand is an integer or a 16.16 fixed-point number, and only an integer may serve as a count, an
 * index or a character code. Every misuse throws `MalformedCharstring`, which draws no glyph, as
 * FreeType fails to load the glyph.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright 2007-2014 Adobe Systems Incorporated.
 * See THIRD-PARTY-NOTICES.md.
 */

import { FIXED_16_16_ONE } from './fontMetrics';

/** A charstring FreeType refuses to load. */
export class MalformedCharstring extends Error {}

interface Operand {
  /** 16.16 fixed point, an integer included. */
  value: number;
  isInteger: boolean;
}

export class OperandStack {
  private readonly operands: Operand[] = [];

  constructor(private readonly capacity: number) {}

  get count(): number {
    return this.operands.length;
  }

  pushInt(value: number): void {
    this.push(value * FIXED_16_16_ONE, true);
  }

  pushFixed(value: number): void {
    this.push(value, false);
  }

  popInt(): number {
    const top = this.operands[this.count - 1];
    if (!top) throw new MalformedCharstring('operand stack underflow');
    if (!top.isInteger)
      throw new MalformedCharstring('expected an integer operand, got a fixed-point number');
    return this.popFixed() >> 16;
  }

  popFixed(): number {
    const top = this.operands.pop();
    if (!top) throw new MalformedCharstring('operand stack underflow');
    return top.value;
  }

  /** The operand `index` places above the bottom, as a fixed-point number. */
  real(index: number): number {
    return this.at(index).value;
  }

  /** Makes the operand `index` places above the bottom a fixed-point number: a blended value is no integer. */
  markFixed(index: number): void {
    this.at(index).isInteger = false;
  }

  /** Drops the `count` operands on top. */
  drop(count: number): void {
    if (count > this.count) throw new MalformedCharstring(`cannot drop ${count} of ${this.count} operands`);
    this.operands.length -= count;
  }

  clear(): void {
    this.operands.length = 0;
  }

  /**
   * Rolls the BOTTOM `count` operands `shift` places toward the top, as `cf2_stack_roll` does: the
   * specification rolls the top ones, and the two agree only when `count` is the whole stack.
   */
  roll(count: number, shift: number): void {
    if (count < 2) return;
    if (count > this.count) throw new MalformedCharstring(`cannot roll ${count} of ${this.count} operands`);
    const by = ((shift % count) + count) % count;
    const rolled = this.operands.slice(0, count);
    this.operands.splice(0, count, ...rolled.slice(count - by), ...rolled.slice(0, count - by));
  }

  private at(index: number): Operand {
    const operand = this.operands[index];
    if (!operand) throw new MalformedCharstring(`operand ${index} is past the ${this.count} on the stack`);
    return operand;
  }

  private push(value: number, isInteger: boolean): void {
    if (this.count >= this.capacity) throw new MalformedCharstring('operand stack overflow');
    this.operands.push({ value, isInteger });
  }
}
