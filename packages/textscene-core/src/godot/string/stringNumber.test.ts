import { describe, expect, it } from 'vitest';
import { numReal, numRealFloat, stringNum } from './stringNumber.js';

describe('String::num', () => {
  it('trims trailing zeros but keeps one digit after the point', () => {
    expect(stringNum(5.5, 1)).toBe('5.5');
    expect(stringNum(5, 2)).toBe('5.0');
  });

  it('writes no point at 0 decimals', () => {
    expect(stringNum(5, 0)).toBe('5');
  });

  it('rounds an exact half to even, as glibc printf does', () => {
    expect(stringNum(0.125, 2)).toBe('0.12');
    expect(stringNum(-2.5, 0)).toBe('-2');
  });

  it('writes six decimals once the default decimals fall below zero', () => {
    expect(stringNum(1e20)).toBe('100000000000000000000.0');
  });
});

describe('String::num_real', () => {
  it('writes a whole value as an integer, with .0 when asked', () => {
    expect(numReal(1, true)).toBe('1.0');
    expect(numReal(-0, true)).toBe('0.0');
    expect(numReal(3, false)).toBe('3');
  });

  it('writes a fraction with 14 decimals in a double and 6 in a float', () => {
    expect(numReal(0.1, true)).toBe('0.1');
    expect(numRealFloat(Math.fround(0.1), true)).toBe('0.1');
    expect(numReal(Math.fround(0.1), true)).toBe('0.10000000149012');
  });
});
