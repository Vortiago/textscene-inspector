import { expect, it } from 'vitest';
import { decimalFloat } from './decimalFloat.js';
import { storedReal } from '../math/real.js';

it('rounds the two mantissa chunks before the setter narrows the result', () => {
  expect(storedReal(decimalFloat('999.999969482421820'))).toBe(999.99993896484375);
});

it('returns the unscaled mantissa when the exponent has no digits', () => {
  expect(decimalFloat('10.00e+')).toBe(1000);
});

it('wraps a long exponent in the signed accumulator', () => {
  expect(decimalFloat('2e4294967296')).toBe(2);
});

it('retains the sign of an underflow', () => {
  expect(decimalFloat('-1e-400')).toBe(-0);
});
