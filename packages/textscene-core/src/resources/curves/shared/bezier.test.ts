import { describe, expect, it } from 'vitest';
import { cubicBezier } from './bezier';

describe('cubicBezier', () => {
  it('starts at the first control value and ends at the last', () => {
    expect(cubicBezier(1, 5, -3, 7, 0)).toBe(1);
    expect(cubicBezier(1, 5, -3, 7, 1)).toBe(7);
  });

  it('weights the four control values 1:3:3:1 at the midpoint', () => {
    expect(cubicBezier(0, 8, 16, 8, 0.5)).toBe((0 + 3 * 8 + 3 * 16 + 8) / 8);
  });

  it('is linear when the handles sit a third of the way along a straight span (edge case)', () => {
    expect(cubicBezier(0, 10, 20, 30, 0.25)).toBeCloseTo(7.5, 12);
  });
});
