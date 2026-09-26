/** The `real_t` storage facts: a single-precision round, and the text that names it. */
import { describe, it, expect } from 'vitest';
import { formatReal, storedReal } from './real.js';

describe('storedReal', () => {
  it('rounds to the nearest single-precision value', () => {
    expect(storedReal(0.99)).toBe(0.9900000095367432);
    expect(storedReal(0.30000001)).toBe(storedReal(0.3));
  });

  it('keeps the values single precision holds exactly', () => {
    expect(storedReal(2)).toBe(2);
    expect(storedReal(-0.5)).toBe(-0.5);
  });

  it('keeps the non-finite values', () => {
    expect(storedReal(Infinity)).toBe(Infinity);
    expect(storedReal(NaN)).toBeNaN();
  });
});

describe('formatReal', () => {
  it('writes the shortest text that reads back as the same single-precision value', () => {
    expect(formatReal(storedReal(0.99))).toBe('0.99');
    expect(formatReal(storedReal(-0.01))).toBe('-0.01');
    expect(formatReal(storedReal(2))).toBe('2');
  });

  it('writes the exponent form Godot writes for a tiny value', () => {
    expect(formatReal(storedReal(storedReal(0.01) - 0.01))).toBe('-2.2351741e-10');
  });

  it('writes the non-finite values as literals Godot reads', () => {
    expect(formatReal(Infinity)).toBe('inf');
    expect(formatReal(-Infinity)).toBe('-inf');
    expect(formatReal(NaN)).toBe('nan');
  });
});
