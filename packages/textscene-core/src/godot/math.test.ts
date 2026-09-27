/**
 * The engine math facts, pinned where a hand-rolled copy got them wrong.
 *
 * Each `smoothstep` case below is one of the three ways the two private copies
 * diverged before they were folded into this module.
 */
import { describe, it, expect } from 'vitest';
import {
  CMP_EPSILON,
  bezierInterpolate,
  isZeroApprox,
  isEqualApprox,
  sign,
  smoothstep,
} from './math.js';

describe('CMP_EPSILON', () => {
  it('is math_defs.h:50, not the 1e-6 a private copy stood in with', () => {
    expect(CMP_EPSILON).toBe(0.00001);
  });
});

describe('sign', () => {
  it('is +1, -1 or 0, with zero unsigned', () => {
    expect(sign(3.5)).toBe(1);
    expect(sign(-3.5)).toBe(-1);
    expect(sign(0)).toBe(0);
    expect(sign(-0)).toBe(0);
  });

  it('reads NaN as 0, where Math.sign reads NaN', () => {
    // Both of `SIGN`'s comparisons are false for NaN, so it falls through to
    // the 0 branch. This is the whole reason the engine's spelling is
    // transcribed rather than delegated.
    expect(sign(NaN)).toBe(0);
    expect(Math.sign(NaN)).toBeNaN();
  });

  it('signs the infinities', () => {
    expect(sign(Infinity)).toBe(1);
    expect(sign(-Infinity)).toBe(-1);
  });
});

describe('isZeroApprox', () => {
  it('accepts what is within the tolerance and rejects what is not', () => {
    expect(isZeroApprox(0)).toBe(true);
    expect(isZeroApprox(5e-6)).toBe(true);
    expect(isZeroApprox(-5e-6)).toBe(true);
    expect(isZeroApprox(2e-5)).toBe(false);
  });

  it('calls a non-finite value non-zero, which the guarded setters rely on', () => {
    expect(isZeroApprox(NaN)).toBe(false);
    expect(isZeroApprox(Infinity)).toBe(false);
  });
});

describe('isEqualApprox', () => {
  it('compares two infinities of the same sign equal, via the exact branch', () => {
    expect(isEqualApprox(Infinity, Infinity)).toBe(true);
    expect(isEqualApprox(Infinity, -Infinity)).toBe(false);
  });

  it('scales the tolerance by the LEFT operand, so it is asymmetric', () => {
    // 1e6 * CMP_EPSILON is 10, so a gap of 5 is within tolerance from the large
    // side and nowhere near it from the small one.
    expect(isEqualApprox(1e6, 1e6 - 5)).toBe(true);
    expect(isEqualApprox(5, 0)).toBe(false);
  });
});

describe('smoothstep', () => {
  it('is the Hermite curve between the edges', () => {
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 12);
    expect(smoothstep(0, 1, 0.25)).toBeCloseTo(0.15625, 12);
  });

  it('clamps outside the span rather than extrapolating', () => {
    expect(smoothstep(0, 1, -3)).toBe(0);
    expect(smoothstep(0, 1, 4)).toBe(1);
  });

  it('answers 0 AT the lower edge of a degenerate span, not 1', () => {
    // math_funcs.h:571 is `p_s <= p_from ? 0.0 : 1.0`. A copy written from the
    // formula spelled it `<`, which inverts this exact point.
    expect(smoothstep(1, 1, 1)).toBe(0);
    expect(smoothstep(1, 1, 1.5)).toBe(1);
    expect(smoothstep(1, 1, 0.5)).toBe(0);
  });

  it('steps for edges that are merely CLOSE, not only identical', () => {
    // The guard is `is_equal_approx` (math_funcs.h:569). With `==` this pair
    // divides by 1e-9 and the curve degenerates into a near-vertical ramp.
    const from = 1;
    const to = 1 + 1e-9;
    expect(smoothstep(from, to, 1 + 5e-10)).toBe(1);
    expect(Number.isNaN(smoothstep(from, to, from))).toBe(false);
  });

  it('answers an inverted degenerate pair from the other side', () => {
    // math_funcs.h:573 is `p_s <= p_to ? 1.0 : 0.0`, measured against `to`, now the lower of the
    // pair, which a single `x < from` cannot express. So `x` at `from` sits above the span and reads 0.
    expect(smoothstep(1, 1 - 1e-9, 1)).toBe(0);
    expect(smoothstep(1, 1 - 1e-9, 0)).toBe(1);
    expect(smoothstep(1, 1 - 1e-9, 2)).toBe(0);
  });

  it('descends when the span is inverted and wide', () => {
    expect(smoothstep(1, 0, 0.25)).toBeCloseTo(0.84375, 12);
  });
});

describe('bezierInterpolate', () => {
  it('starts at the first control value and ends at the last', () => {
    expect(bezierInterpolate(1, 5, -3, 7, 0)).toBe(1);
    expect(bezierInterpolate(1, 5, -3, 7, 1)).toBe(7);
  });

  it('weights the four control values 1:3:3:1 at the midpoint', () => {
    expect(bezierInterpolate(0, 8, 16, 8, 0.5)).toBe((0 + 3 * 8 + 3 * 16 + 8) / 8);
  });

  it('is linear when the handles sit a third of the way along a straight span (edge case)', () => {
    expect(bezierInterpolate(0, 10, 20, 30, 0.25)).toBeCloseTo(7.5, 12);
  });
});
