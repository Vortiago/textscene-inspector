import { describe, expect, it } from 'vitest';
import {
  affineInverseTransform3D,
  decomposeTransform3D,
  identityTransform3D,
  sameTransform3D,
  interpolateTransform3D,
  multiplyTransform3D,
  transform3DFromQuaternionScale,
  type Transform3D,
} from './transform3d.js';

describe('identityTransform3D', () => {
  it('holds the identity basis rows and a zero origin', () => {
    expect(identityTransform3D()).toEqual({
      basis_x: { x: 1, y: 0, z: 0 },
      basis_y: { x: 0, y: 1, z: 0 },
      basis_z: { x: 0, y: 0, z: 1 },
      origin: { x: 0, y: 0, z: 0 },
    });
  });

  it('returns a fresh value each call, so a caller may mutate it (edge case)', () => {
    const first = identityTransform3D();
    first.origin.x = 5;
    expect(identityTransform3D().origin.x).toBe(0);
  });
});

/** A quarter turn about Z, then a move of (0, 1, 0). */
const TURNED_AND_RAISED: Transform3D = {
  basis_x: { x: 0, y: -1, z: 0 },
  basis_y: { x: 1, y: 0, z: 0 },
  basis_z: { x: 0, y: 0, z: 1 },
  origin: { x: 0, y: 1, z: 0 },
};

function expectOrigin(transform: Transform3D, x: number, y: number, z: number): void {
  expect(transform.origin.x).toBeCloseTo(x, 6);
  expect(transform.origin.y).toBeCloseTo(y, 6);
  expect(transform.origin.z).toBeCloseTo(z, 6);
}

describe('multiplyTransform3D', () => {
  it('places the right transform in the left one, as Transform3D::operator* does', () => {
    const moved = { ...identityTransform3D(), origin: { x: 1, y: 0, z: 0 } };

    // The point (1, 0, 0) turns to (0, 1, 0), then moves to (0, 2, 0).
    expectOrigin(multiplyTransform3D(TURNED_AND_RAISED, moved), 0, 2, 0);
    // Moved first, the turned origin is moved: (0, 1, 0) + (1, 0, 0).
    expectOrigin(multiplyTransform3D(moved, TURNED_AND_RAISED), 1, 1, 0);
  });

  it('keeps a transform when multiplied by the identity', () => {
    expect(multiplyTransform3D(TURNED_AND_RAISED, identityTransform3D())).toEqual(TURNED_AND_RAISED);
  });
});

describe('affineInverseTransform3D', () => {
  it('undoes a turn and a move', () => {
    const inverse = affineInverseTransform3D(TURNED_AND_RAISED);

    expect(inverse.basis_x.y).toBeCloseTo(1, 6);
    expect(inverse.basis_y.x).toBeCloseTo(-1, 6);
    expectOrigin(inverse, -1, 0, 0);
    expectOrigin(multiplyTransform3D(TURNED_AND_RAISED, inverse), 0, 0, 0);
  });

  it('inverts a scale', () => {
    const scaled = { ...identityTransform3D(), basis_x: { x: 2, y: 0, z: 0 }, origin: { x: 4, y: 0, z: 0 } };

    expect(affineInverseTransform3D(scaled).basis_x.x).toBeCloseTo(0.5, 6);
    expectOrigin(affineInverseTransform3D(scaled), -2, 0, 0);
  });

  it('leaves the basis of a singular transform as it is, as the editor build does (edge case)', () => {
    const flat = { ...identityTransform3D(), basis_y: { x: 0, y: 0, z: 0 }, origin: { x: 1, y: 2, z: 3 } };

    expect(affineInverseTransform3D(flat).basis_y).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('transform3DFromQuaternionScale', () => {
  it('builds the pose Skeleton3D caches: rotation and scale in the basis, position as the origin', () => {
    const pose = transform3DFromQuaternionScale(
      { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 },
      { x: 2, y: 3, z: 4 },
      { x: 5, y: 6, z: 7 }
    );

    expect(pose.basis_x.y).toBeCloseTo(-3, 6);
    expect(pose.basis_y.x).toBeCloseTo(2, 6);
    expect(pose.basis_z.z).toBeCloseTo(4, 6);
    expectOrigin(pose, 5, 6, 7);
  });
});

describe('decomposeTransform3D', () => {
  // `Transform3D(Basis(Quaternion(Vector3(0, 1, 0), 0.4)).scaled(Vector3(1, 2, 3)), Vector3(1, 2, 3))` in Godot 4.6.3.
  const scaledAndTurned = transform3DFromRows([0.921061, 0, 0.38941833, 0, 2, 0, -1.168255, 0, 2.7631829], {
    x: 1,
    y: 2,
    z: 3,
  });

  it('reads the rotation quaternion and the column scale of the basis, as Godot prints them', () => {
    const { rotation, scale } = decomposeTransform3D(scaledAndTurned);

    expect(rotation.y).toBeCloseTo(0.43638954, 6);
    expect(rotation.w).toBeCloseTo(0.89975786, 6);
    expect(scale.x).toBeCloseTo(1.4876736, 6);
    expect(scale.y).toBeCloseTo(2, 6);
    expect(scale.z).toBeCloseTo(2.7904885, 6);
  });

  it('gives the identity rotation and a unit scale for the identity (edge case)', () => {
    expect(decomposeTransform3D(identityTransform3D())).toEqual({
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    });
  });
});

describe('interpolateTransform3D', () => {
  // `Transform3D(Basis(Quaternion(Vector3(0, 1, 0), 0.4)).scaled(Vector3(1, 2, 3)), Vector3(1, 2, 3))` and
  // `Transform3D(Basis(Quaternion(Vector3(0, 0, 1), 1.2)).scaled(Vector3(2, 1, 1)), Vector3(-1, 0.5, 4))`.
  const from = transform3DFromRows([0.921061, 0, 0.38941833, 0, 2, 0, -1.168255, 0, 2.7631829], {
    x: 1,
    y: 2,
    z: 3,
  });
  const to = transform3DFromRows([0.7247155, -1.8640783, 0, 0.93203914, 0.36235774, 0, 0, 0, 1], {
    x: -1,
    y: 0.5,
    z: 4,
  });

  it('blends rotation, scale and origin as Godot prints it', () => {
    const blended = interpolateTransform3D(from, to, 0.35);

    expect(blended.origin.x).toBeCloseTo(0.3, 6);
    expect(blended.origin.y).toBeCloseTo(1.475, 6);
    expect(blended.origin.z).toBeCloseTo(3.35, 6);
    expect(blended.basis_x.x).toBeCloseTo(1.0666939, 5);
    expect(blended.basis_y.y).toBeCloseTo(1.8600904, 5);
    expect(blended.basis_z.z).toBeCloseTo(1.787451, 5);
  });

  it('returns the first transform at weight 0 (edge case)', () => {
    const blended = interpolateTransform3D(from, to, 0);

    expect(blended.origin).toEqual(from.origin);
    expect(blended.basis_y.y).toBeCloseTo(2, 5);
  });
});

describe('sameTransform3D', () => {
  it('holds for equal components and fails for a change in any row', () => {
    const base = identityTransform3D();

    expect(sameTransform3D(base, identityTransform3D())).toBe(true);
    expect(sameTransform3D(base, { ...base, basis_z: { x: 0, y: 0, z: 1.5 } })).toBe(false);
    expect(sameTransform3D(base, { ...base, origin: { x: 0, y: 0, z: 1e-9 } })).toBe(false);
  });

  it('finds a transform with a NaN in it equal to its copy (edge case)', () => {
    const withNaN = { ...identityTransform3D(), origin: { x: NaN, y: 0, z: 0 } };

    expect(sameTransform3D(withNaN, { ...withNaN })).toBe(true);
  });
});

/** A transform from nine row-major basis components. */
function transform3DFromRows(rows: number[], origin: Transform3D['origin']): Transform3D {
  return {
    basis_x: { x: rows[0]!, y: rows[1]!, z: rows[2]! },
    basis_y: { x: rows[3]!, y: rows[4]!, z: rows[5]! },
    basis_z: { x: rows[6]!, y: rows[7]!, z: rows[8]! },
    origin,
  };
}
