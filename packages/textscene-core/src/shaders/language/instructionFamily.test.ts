import { describe, expect, it } from 'vitest';
import { isFunctionRow } from './instructionFamily.js';
import { INSTRUCTION_TABLE } from './instructionTable.generated.js';

describe('isFunctionRow', () => {
  it('tells a plain built-in function row', () => {
    expect(isFunctionRow({ family: 'function' })).toBe(true);
  });

  it('tells a high_end built-in function row', () => {
    expect(isFunctionRow({ family: 'function (high_end)' })).toBe(true);
  });

  it('leaves out a constructor and an operator', () => {
    expect([isFunctionRow({ family: 'constructor' }), isFunctionRow({ family: 'operator' })]).toEqual([
      false,
      false,
    ]);
  });

  it('finds both sets of functions in the table', () => {
    const families = new Set(INSTRUCTION_TABLE.filter(isFunctionRow).map((row) => row.family));
    expect([...families].sort()).toEqual(['function', 'function (high_end)']);
  });
});
