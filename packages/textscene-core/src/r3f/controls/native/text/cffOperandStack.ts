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

/** A charstring FreeType refuses to load. */
export class MalformedCharstring extends Error {}

export const FIXED_ONE = 0x10000;

export class OperandStack {
  private fixeds: number[] = [];
  private integerFlags: boolean[] = [];

  constructor(private readonly capacity: number) {}

  get count(): number {
    return this.fixeds.length;
  }

  pushInt(value: number): void {
    this.push(value * FIXED_ONE, true);
  }

  pushFixed(value: number): void {
    this.push(value, false);
  }

  popInt(): number {
    if (this.count === 0) throw new MalformedCharstring('operand stack underflow');
    if (!this.integerFlags[this.count - 1])
      throw new MalformedCharstring('expected an integer operand, got a fixed-point number');
    return this.popFixed() >> 16;
  }

  popFixed(): number {
    const value = this.fixeds.pop();
    this.integerFlags.pop();
    if (value === undefined) throw new MalformedCharstring('operand stack underflow');
    return value;
  }

  /** The operand `index` places above the bottom, as a fixed-point number. */
  real(index: number): number {
    const value = this.fixeds[index];
    if (value === undefined)
      throw new MalformedCharstring(`operand ${index} is past the ${this.count} on the stack`);
    return value;
  }

  setReal(index: number, value: number): void {
    if (index >= this.count)
      throw new MalformedCharstring(`operand ${index} is past the ${this.count} on the stack`);
    this.fixeds[index] = value;
    this.integerFlags[index] = false;
  }

  /** Drops the `count` operands on top. */
  drop(count: number): void {
    if (count > this.count) throw new MalformedCharstring(`cannot drop ${count} of ${this.count} operands`);
    this.fixeds.length -= count;
    this.integerFlags.length -= count;
  }

  clear(): void {
    this.fixeds = [];
    this.integerFlags = [];
  }

  /**
   * Rolls the BOTTOM `count` operands `shift` places toward the top, as `cf2_stack_roll` does: the
   * specification rolls the top ones, and the two agree only when `count` is the whole stack.
   */
  roll(count: number, shift: number): void {
    if (count < 2) return;
    if (count > this.count) throw new MalformedCharstring(`cannot roll ${count} of ${this.count} operands`);
    const by = ((shift % count) + count) % count;
    const rotate = <T>(items: T[]) => {
      const rolled = items.slice(0, count);
      items.splice(0, count, ...rolled.slice(count - by), ...rolled.slice(0, count - by));
    };
    rotate(this.fixeds);
    rotate(this.integerFlags);
  }

  private push(fixed: number, isInteger: boolean): void {
    if (this.count >= this.capacity) throw new MalformedCharstring('operand stack overflow');
    this.fixeds.push(fixed);
    this.integerFlags.push(isInteger);
  }
}
