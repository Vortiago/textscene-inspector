/** The float `Basis` methods the particle simulations call, each written into the basis it is given. */
import { describe, expect, it } from 'vitest';
import type { MutableBasis } from './basis.js';
import { basisScale, basisSetAxisAngle } from './basisFloat.js';

describe('basisSetAxisAngle', () => {
  it('writes the rotation about a unit axis into the basis', () => {
    const basis: MutableBasis = [2, 0, 0, 0, 2, 0, 0, 0, 2];
    const turned = basisSetAxisAngle(basis, { x: 0, y: 0, z: 1 }, Math.PI);

    expect(turned).toBe(basis);
    expect(basis.map((component) => Math.round(component))).toEqual([-1, -0, 0, 0, -1, 0, 0, 0, 1]);
  });

  it('writes the identity for an axis that is not normalised, as MATH_CHECKS leaves it (edge case)', () => {
    const basis: MutableBasis = [2, 0, 0, 0, 2, 0, 0, 0, 2];

    expect(basisSetAxisAngle(basis, { x: 0, y: 2, z: 0 }, 1)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });
});

describe('basisScale', () => {
  it('multiplies each row by its axis of the scale, in place', () => {
    const basis: MutableBasis = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    expect(basisScale(basis, 2, 0.5, -1)).toBe(basis);
    expect(basis).toEqual([2, 4, 6, 2, 2.5, 3, -7, -8, -9]);
  });
});
