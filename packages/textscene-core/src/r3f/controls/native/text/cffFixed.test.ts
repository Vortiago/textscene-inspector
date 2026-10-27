import { describe, expect, it } from 'vitest';
import { ftMulDiv } from './cffFixed';

describe('ftMulDiv', () => {
  it('rounds half up on the magnitude and signs the quotient', () => {
    expect(ftMulDiv(3, 5, 2)).toBe(8);
    expect(ftMulDiv(-3, 5, 2)).toBe(-8);
    expect(ftMulDiv(-3, -5, 2)).toBe(8);
  });

  it('gives the largest 32-bit magnitude for a zero divisor, signed by the product', () => {
    expect(ftMulDiv(3, 5, 0)).toBe(0x7fffffff);
    expect(ftMulDiv(-3, 5, 0)).toBe(-0x7fffffff);
  });
});
