import { describe, expect, it } from 'vitest';
import { toPascalCase } from './compoundWords';
import { dedent, indent, replace } from './edit';

/** A line longer than V8 spreads into one call's arguments. */
const LONG = 1_000_000;
const letters = (count: number, code = 0x61) => new Array<number>(count).fill(code);
const TAB = 0x09;

describe('a text longer than one call takes as arguments', () => {
  it('indents a long line (edge case)', () => {
    expect(indent(letters(LONG), [TAB])).toHaveLength(LONG + 1);
  });

  it('dedents a long line (edge case)', () => {
    expect(dedent([TAB, ...letters(LONG)])).toHaveLength(LONG);
  });

  it('replaces with a long replacement (edge case)', () => {
    expect(replace([0x78], [0x78], letters(LONG), (code) => code)).toHaveLength(LONG);
  });

  it('joins a long compound word (edge case)', () => {
    expect(toPascalCase(letters(LONG))).toHaveLength(LONG);
  });
});
