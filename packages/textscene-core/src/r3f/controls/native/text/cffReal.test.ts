import { describe, expect, it } from 'vitest';
import { readRealValue, realEnd } from './cffReal';
import { dictOperandBytes } from './sfntCff.testkit';

/** The real written as a DICT operand, with a byte of padding in front of it and one after it. */
function realOperand(text: string): { dv: DataView; start: number; limit: number } {
  const bytes = [0x8b, ...dictOperandBytes({ real: text }), 0x8b];
  return { dv: new DataView(new Uint8Array(bytes).buffer), start: 1, limit: bytes.length };
}

describe('the packed real of a DICT', () => {
  it.each([
    ['0.039625', 0.039625],
    ['-12.5', -12.5],
    ['1E-3', 0.001],
    ['2.5E2', 250],
    ['120', 120],
  ])('reads %s', (text, expected) => {
    const { dv, start, limit } = realOperand(text);
    expect(readRealValue(dv, start, limit)).toBe(expected);
  });

  it('keeps nine digits after the point, as FreeType does', () => {
    const { dv, start, limit } = realOperand('0.12345678901');
    expect(readRealValue(dv, start, limit)).toBe(0.123456789);
  });

  it('reads 0 where the data ends before the number does', () => {
    const { dv, start } = realOperand('0.5');
    expect(readRealValue(dv, start, start + 1)).toBe(0);
  });

  it('ends after the byte that holds the terminating nibble', () => {
    const { dv, start, limit } = realOperand('0.039625');
    expect(realEnd(dv, start)).toBe(limit - 1);
  });
});
