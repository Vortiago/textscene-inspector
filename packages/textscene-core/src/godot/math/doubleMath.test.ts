import { describe, expect, it } from 'vitest';
import { GodotCrash } from '../variant/cInteger.js';
import { asin, atanh, fposmod, stepDecimals, wrapi } from './doubleMath.js';

describe('the clamping overloads', () => {
  it('answer outside the domain instead of NaN', () => {
    expect(asin(-2)).toBe(-Math.PI / 2);
    expect(atanh(1)).toBe(Infinity);
  });
});

describe('fposmod', () => {
  it('folds to the sign of the divisor and drops a negative zero', () => {
    expect(fposmod(-7.5, 2)).toBe(0.5);
    expect(Object.is(fposmod(-4, 2), 0)).toBe(true);
  });
});

describe('wrapi', () => {
  it('wraps in int64', () => {
    expect(wrapi(-1n, 0n, 3n)).toBe(2n);
  });

  it('crashes Godot on INT64_MIN % -1', () => {
    expect(() => wrapi(-(1n << 63n), 0n, -1n)).toThrow(GodotCrash);
  });
});

describe('stepDecimals', () => {
  it('counts the decimals of the fraction', () => {
    expect(stepDecimals(0.0125)).toBe(2);
  });

  it('reads no fraction past the int32 range, where the int cast gives INT32_MIN', () => {
    expect(stepDecimals(3000000000.5)).toBe(0);
  });
});
