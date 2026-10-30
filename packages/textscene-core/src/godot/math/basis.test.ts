/** The `Basis` reads Godot's own configuration warnings run. */

import { describe, it, expect } from 'vitest';
import {
  type BasisComponents,
  basisDiagonal,
  basisGetScale,
  basisGetScaleAbs,
  basisHasUnitScale,
  basisFromQuaternion,
  basisFromQuaternionScale,
  basisGetRotationQuaternion,
  basisInvert,
  basisIsOrthonormal,
  basisMultiply,
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

const HALF_TURN_SCALE = Math.SQRT1_2;
/** A quarter turn about Z: the rows `(0, -1, 0)`, `(1, 0, 0)`, `(0, 0, 1)`. */
const QUARTER_TURN_Z: BasisComponents = [0, -1, 0, 1, 0, 0, 0, 0, 1];

function expectBasisClose(actual: BasisComponents, expected: BasisComponents): void {
  expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 6));
}

describe('basisFromQuaternion', () => {
  it('turns the identity quaternion into the identity basis', () => {
    expect(basisFromQuaternion({ x: 0, y: 0, z: 0, w: 1 })).toEqual(IDENTITY);
  });

  it('turns a quarter turn about Z into its rotation matrix', () => {
    const basis = basisFromQuaternion({ x: 0, y: 0, z: HALF_TURN_SCALE, w: HALF_TURN_SCALE });

    expectBasisClose(basis, QUARTER_TURN_Z);
  });

  it('normalises a quaternion that is not unit length (edge case)', () => {
    expectBasisClose(basisFromQuaternion({ x: 0, y: 0, z: 5, w: 5 }), QUARTER_TURN_Z);
  });
});

describe('basisMultiply', () => {
  it('composes the right basis first, as Basis::operator* does', () => {
    const scaleX: BasisComponents = [2, 0, 0, 0, 1, 0, 0, 0, 1];

    // Rotate after scaling: the x scale lands in the first column.
    expectBasisClose(basisMultiply(QUARTER_TURN_Z, scaleX), [0, -1, 0, 2, 0, 0, 0, 0, 1]);
    // Scale after rotating: it lands in the first row.
    expectBasisClose(basisMultiply(scaleX, QUARTER_TURN_Z), [0, -2, 0, 1, 0, 0, 0, 0, 1]);
  });

  it('leaves a basis alone when multiplied by the identity', () => {
    expect(basisMultiply(QUARTER_TURN_Z, IDENTITY)).toEqual(QUARTER_TURN_Z);
  });
});

describe('basisFromQuaternionScale', () => {
  it('scales each column of the rotation by its axis, as Basis(quaternion, scale) does', () => {
    const basis = basisFromQuaternionScale(
      { x: 0, y: 0, z: HALF_TURN_SCALE, w: HALF_TURN_SCALE },
      { x: 2, y: 3, z: 4 }
    );

    expectBasisClose(basis, [0, -3, 0, 2, 0, 0, 0, 0, 4]);
  });

  it('gives a zero scale a flat basis (edge case)', () => {
    const basis = basisFromQuaternionScale({ x: 0, y: 0, z: 0, w: 1 }, { x: 1, y: 0, z: 1 });

    expect(basis).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 1]);
  });
});

describe('basisDiagonal', () => {
  it('holds each scale in float32 on the diagonal', () => {
    expect(basisDiagonal(0.1, 2, -3)).toEqual([Math.fround(0.1), 0, 0, 0, 2, 0, 0, 0, -3]);
  });
});

describe('basisGetRotationQuaternion', () => {
  // `Basis(Quaternion(Vector3(0.3, 0.5, 0.8).normalized(), 1.1)).scaled(Vector3(2, 0.5, 1.5))` in Godot 4.6.3.
  const rotation = { x: 0.11514294, y: 0.22789943, z: 0.1502343, w: 0.95510924 };
  const scaledRows = (basis: BasisComponents, scale: readonly [number, number, number]): BasisComponents =>
    basis.map((value, i) => value * scale[Math.floor(i / 3)]!) as unknown as BasisComponents;

  it('returns the rotation of a basis that also scales, as Godot prints it', () => {
    const basis = scaledRows(basisFromQuaternion(unitQuaternionAbout([0.3, 0.5, 0.8], 1.1)), [2, 0.5, 1.5]);

    const result = basisGetRotationQuaternion(basis);

    expect(result.x).toBeCloseTo(rotation.x, 6);
    expect(result.y).toBeCloseTo(rotation.y, 6);
    expect(result.z).toBeCloseTo(rotation.z, 6);
    expect(result.w).toBeCloseTo(rotation.w, 6);
  });

  it('returns the identity quaternion for the identity basis', () => {
    expect(basisGetRotationQuaternion(IDENTITY)).toEqual({ x: 0, y: 0, z: 0, w: 1 });
  });

  it('flips a mirrored basis into a proper rotation first (edge case)', () => {
    const result = basisGetRotationQuaternion(MIRRORED);

    // Godot negates the orthonormalised basis (-1 -> 1 on x, 1 -> -1 on y and z): a half turn about X.
    expect(result.x).toBeCloseTo(1, 6);
    expect(result.w).toBeCloseTo(0, 6);
  });
});

/** The unit quaternion that turns `angle` about `axis`, built from the half-angle formula. */
function unitQuaternionAbout(axis: readonly [number, number, number], angle: number) {
  const length = Math.hypot(...axis);
  const sine = Math.sin(angle / 2) / length;
  return { x: axis[0] * sine, y: axis[1] * sine, z: axis[2] * sine, w: Math.cos(angle / 2) };
}
