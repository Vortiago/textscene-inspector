import { describe, expect, it } from 'vitest';
import { normalizedVector3, vector3Cross, vector3Dot } from './vector';

describe('normalizedVector3', () => {
  it('scales a vector to unit length', () => {
    expect(normalizedVector3(3, 0, 4)).toEqual([Math.fround(0.6), 0, Math.fround(0.8)]);
  });

  it('keeps a negative component negative', () => {
    expect(normalizedVector3(0, -2, 0)).toEqual([0, -1, 0]);
  });

  it('leaves a zero vector zero, as Vector3::normalize does (edge case)', () => {
    expect(normalizedVector3(0, 0, 0)).toEqual([0, 0, 0]);
  });
});

describe('vector3Dot', () => {
  it('sums the products of the components', () => {
    expect(vector3Dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it('rounds each product and sum to single precision', () => {
    // In double precision 0.1 * 3 + 0 + 0 is 0.30000000000000004, not the float of 0.3.
    expect(vector3Dot([0.1, 0, 0], [3, 0, 0])).toBe(Math.fround(Math.fround(0.1) * 3));
  });
});

describe('vector3Cross', () => {
  it('turns +X and +Y into +Z', () => {
    expect(vector3Cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
  });

  it('turns two parallel vectors into zero', () => {
    expect(vector3Cross([1, 2, 3], [2, 4, 6])).toEqual([0, 0, 0]);
  });
});
