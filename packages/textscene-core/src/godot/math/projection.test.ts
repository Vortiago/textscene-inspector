import { describe, expect, it } from 'vitest';
import { getFovy } from './projection.js';

describe('getFovy', () => {
  it('narrows a horizontal fov by the reciprocal of a wide aspect', () => {
    expect(getFovy(90, 9 / 16)).toBeCloseTo(58.7155, 3);
  });

  it('rounds as Projection::get_fovy does, not as (2 * atan(tan(..) / aspect) * 180) / PI', () => {
    expect(getFovy(31, 1 / (16 / 9))).toBe(17.732799010746273);
  });

  it('returns the same fov for an aspect of 1 (edge case)', () => {
    expect(getFovy(60, 1)).toBeCloseTo(60, 10);
  });
});
