import { describe, expect, it } from 'vitest';
import { CMP_EPSILON } from './math.js';
import { acosf, asinf, cosf, fposmodf, isEqualApproxf, isZeroApproxf, sinf, sqrtf } from './realMath.js';

const f = Math.fround;

describe('float square root, sine and cosine', () => {
  it('rounds each result to single precision', () => {
    expect(sqrtf(2)).toBe(f(Math.SQRT2));
    expect(sinf(0.3)).toBe(f(Math.sin(0.3)));
    expect(cosf(0.3)).toBe(f(Math.cos(0.3)));
  });

  it('gives NaN for the square root of a negative number', () => {
    expect(sqrtf(-1)).toBeNaN();
  });
});

describe('fposmodf', () => {
  it('moves a remainder to the sign of the divisor', () => {
    expect(fposmodf(-1, 3)).toBe(2);
    expect(fposmodf(1, -3)).toBe(-2);
  });

  it('gives positive zero for a negative multiple', () => {
    expect(Object.is(fposmodf(-6, 3), 0)).toBe(true);
  });

  it('gives NaN for a zero divisor', () => {
    expect(fposmodf(1, 0)).toBeNaN();
  });
});

describe('isEqualApproxf', () => {
  it('scales the tolerance with the first value', () => {
    expect(isEqualApproxf(1000, 1000.0001)).toBe(true);
    expect(isEqualApproxf(1, 1.0001)).toBe(false);
  });

  it('keeps the float epsilon as the smallest tolerance', () => {
    expect(isEqualApproxf(0, f(CMP_EPSILON) / 2)).toBe(true);
    expect(isEqualApproxf(0, f(CMP_EPSILON) * 2)).toBe(false);
  });

  it('accepts two equal infinities', () => {
    expect(isEqualApproxf(Infinity, Infinity)).toBe(true);
  });
});

describe('isZeroApproxf', () => {
  it('accepts a value below the float epsilon and refuses one at it', () => {
    expect(isZeroApproxf(f(CMP_EPSILON) / 2)).toBe(true);
    expect(isZeroApproxf(f(CMP_EPSILON))).toBe(false);
  });

  it('refuses NaN', () => {
    expect(isZeroApproxf(NaN)).toBe(false);
  });
});

describe('asinf and acosf', () => {
  it('clamp an input past the ends as Godot does', () => {
    expect(asinf(2)).toBe(f(Math.PI / 2));
    expect(asinf(-2)).toBe(-f(Math.PI / 2));
    expect(acosf(2)).toBe(0);
    expect(acosf(-2)).toBe(f(Math.PI));
  });

  it('round the angle inside the range to single precision', () => {
    expect(asinf(0.3)).toBe(f(Math.asin(0.3)));
    expect(acosf(f(0.3))).toBe(f(1.26610363));
  });

  it('give NaN for NaN', () => {
    expect(asinf(NaN)).toBeNaN();
    expect(acosf(NaN)).toBeNaN();
  });
});
