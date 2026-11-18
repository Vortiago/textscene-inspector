import { describe, expect, it } from 'vitest';
import { IDENTITY_BASIS, type BasisComponents } from './basis.js';
import { basisGetEulerNormalized, EulerOrder } from './euler.js';

const HALF_PI = Math.fround(Math.PI / 2);

describe('basisGetEulerNormalized', () => {
  it('gives no turn for the identity', () => {
    expect(basisGetEulerNormalized(IDENTITY_BASIS, EulerOrder.YXZ).map(Math.abs)).toEqual([0, 0, 0]);
  });

  it('sends a NaN pole test to the +1 pole, as Godot tests `sy < 1 - CMP_EPSILON` first', () => {
    const withNaN = [NaN, 0, 0, 0, 1, 0, 0, 0, 1] as unknown as BasisComponents;
    expect(basisGetEulerNormalized(withNaN, EulerOrder.XYZ)[1]).toBe(HALF_PI);
  });
});
