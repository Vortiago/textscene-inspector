/** The `Basis` reads Godot's own configuration warnings run. */

import { describe, it, expect } from 'vitest';
import {
  type BasisComponents,
  basisGetScale,
  basisGetScaleAbs,
  basisHasUnitScale,
  basisInvert,
  basisIsOrthonormal,
  basisOrthonormalized,
} from './basis.js';

const IDENTITY: BasisComponents = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** Rows `(1, 0.5, 0)`, `(0, 1, 0)`, `(0, 0, 1)`: a shear in the second column. */
const SHEARED: BasisComponents = [1, 0.5, 0, 0, 1, 0, 0, 0, 1];
/** Determinant -1, every column still unit. */
const MIRRORED: BasisComponents = [-1, 0, 0, 0, 1, 0, 0, 0, 1];
const infFirst = (value: number): BasisComponents => [value, 0, 0, 0, 1, 0, 0, 0, 1];

describe('basisGetScaleAbs', () => {
  it('measures the columns, not the rows', () => {
    // Row 0 is the longer vector here (1.118), so a row-major read would put
    // the shear on the x axis instead of the y.
    const [x, y, z] = basisGetScaleAbs(SHEARED);
    expect(x).toBe(1);
    expect(y).toBeCloseTo(Math.hypot(0.5, 1), 10);
    expect(z).toBe(1);
  });
});

describe('basisGetScale', () => {
  it('carries one determinant sign into all three axes', () => {
    // basis.cpp:321-322 multiplies get_scale_abs() by a single det_sign, so a
    // mirrored basis reads (-1, -1, -1) rather than three unit magnitudes.
    expect(basisGetScale(MIRRORED)).toEqual([-1, -1, -1]);
    expect(basisGetScale(IDENTITY)).toEqual([1, 1, 1]);
  });

  it('scales a degenerate basis to zero, since SIGN is three-valued', () => {
    expect(basisGetScale([2, 0, 0, 0, 2, 0, 0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('leaves a nan axis NaN and collapses the others to zero', () => {
    // SIGN takes neither comparison on a NaN determinant and returns 0.
    const [x, y, z] = basisGetScale(infFirst(NaN));
    expect(x).toBeNaN();
    expect(y).toBe(0);
    expect(z).toBe(0);
  });

  it('keeps an infinite column infinite, signed by the determinant', () => {
    expect(basisGetScale(infFirst(Infinity))).toEqual([Infinity, 1, 1]);
    // `get_scale_abs()` is unsigned (+inf); the determinant is -inf, so the
    // shared det_sign of -1 puts the sign back on every axis.
    expect(basisGetScale(infFirst(-Infinity))).toEqual([-Infinity, -1, -1]);
  });
});

describe('basisHasUnitScale', () => {
  it('accepts the identity and refuses a mirror, a shear and a non-finite axis', () => {
    expect(basisHasUnitScale(IDENTITY)).toBe(true);
    expect(basisHasUnitScale(MIRRORED)).toBe(false);
    expect(basisHasUnitScale(SHEARED)).toBe(false);
    expect(basisHasUnitScale(infFirst(Infinity))).toBe(false);
    // NaN, because every comparison against it is false, not because it compares greater or
    // less than 1.
    expect(basisHasUnitScale(infFirst(NaN))).toBe(false);
  });
});

describe('basisIsOrthonormal', () => {
  it('accepts the identity and a rotation', () => {
    expect(basisIsOrthonormal(IDENTITY)).toBe(true);
    expect(basisIsOrthonormal([0, -1, 0, 1, 0, 0, 0, 0, 1])).toBe(true);
    // A mirror is orthonormal: unit columns, perpendicular pairs, and
    // basis.cpp:107 never looks at the determinant.
    expect(basisIsOrthonormal(MIRRORED)).toBe(true);
  });

  it('refuses scale, shear and a non-finite column', () => {
    expect(basisIsOrthonormal([2, 0, 0, 0, 1, 0, 0, 0, 1])).toBe(false);
    expect(basisIsOrthonormal(SHEARED)).toBe(false);
    expect(basisIsOrthonormal(infFirst(Infinity))).toBe(false);
    expect(basisIsOrthonormal(infFirst(NaN))).toBe(false);
  });
});

describe('basisInvert', () => {
  /** Equal to 12 places, so a `-0` from a cofactor reads as the `0` it is. */
  const expectInverse = (basis: BasisComponents, expected: readonly number[]): void => {
    expected.forEach((value, i) => expect(basisInvert(basis)[i]).toBeCloseTo(value, 12));
  };

  it('turns a quarter turn about Z into its transpose', () => {
    expectInverse([0, -1, 0, 1, 0, 0, 0, 0, 1], [0, 1, 0, -1, 0, 0, 0, 0, 1]);
  });

  it('divides a scale: diag(2, 4, 5) inverts to diag(0.5, 0.25, 0.2 in float)', () => {
    expectInverse([2, 0, 0, 0, 4, 0, 0, 0, 5], [0.5, 0, 0, 0, 0.25, 0, 0, 0, Math.fround(0.2)]);
  });

  it('undoes a shear', () => {
    expectInverse(SHEARED, [1, -0.5, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('rounds each step to float, as `real_t` does', () => {
    expect(basisInvert([3, 0, 0, 0, 1, 0, 0, 0, 1])[0]).toBe(Math.fround(1 / 3));
  });

  it('leaves a singular basis as it is, as the editor build does (edge case)', () => {
    const singular: BasisComponents = [0, 0, 0, 0, 1, 0, 0, 0, 0];
    expect(basisInvert(singular)).toBe(singular);
  });
});

describe('basisOrthonormalized', () => {
  it('drops a scale, keeping the direction of each column', () => {
    expect(basisOrthonormalized([4, 0, 0, 0, 0.5, 0, 0, 0, 2])).toEqual(IDENTITY);
  });

  it('removes a shear by Gram-Schmidt, so the first column keeps its direction (basis.cpp:56-72)', () => {
    const [xx, yx, zx, xy, yy, zy, xz, yz, zz] = basisOrthonormalized([1, 1, 0, 0, 1, 0, 0, 0, 1]);

    expect([xx, xy, xz]).toEqual([1, 0, 0]);
    expect([yx, yy, yz]).toEqual([0, 1, 0]);
    expect([zx, zy, zz]).toEqual([0, 0, 1]);
  });

  it('gives an orthonormal basis for a turned, sheared and scaled one', () => {
    expect(basisIsOrthonormal(basisOrthonormalized([2, 1, 0.3, -1, 3, 0.2, 0.5, 0.1, 4]))).toBe(true);
  });
});
