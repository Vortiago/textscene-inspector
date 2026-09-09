/** The `Basis` reads Godot's own configuration warnings run. */

import { describe, it, expect } from 'vitest';
import {
  type BasisComponents,
  basisGetScale,
  basisGetScaleAbs,
  basisHasUnitScale,
  basisIsOrthonormal,
} from './basis.js';

const IDENTITY: BasisComponents = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** Rows `(1, 0.5, 0)`, `(0, 1, 0)`, `(0, 0, 1)` — a shear in the second COLUMN. */
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
    // NaN, because EVERY comparison against it is false — not because it
    // compares greater or less than 1.
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
