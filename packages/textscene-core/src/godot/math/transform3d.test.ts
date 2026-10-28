import { describe, expect, it } from 'vitest';
import {
  affineInverseTransform3D,
  identityTransform3D,
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
