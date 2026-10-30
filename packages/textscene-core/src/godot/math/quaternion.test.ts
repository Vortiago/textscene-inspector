import { describe, expect, it } from 'vitest';
import {
  normalizedQuaternion,
  quaternionFromAxisAngle,
  quaternionInverse,
  quaternionMultiply,
  quaternionSlerp,
  type Quaternion,
} from './quaternion.js';

// Expected values are what Godot 4.6.3 prints for the same call (`var_to_str`).
const TURN_ABOUT_Z: Quaternion = quaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.5);
const TURN_ABOUT_X: Quaternion = quaternionFromAxisAngle({ x: 1, y: 0, z: 0 }, 1.9);

function expectQuaternion(actual: Quaternion, x: number, y: number, z: number, w: number): void {
  expect(actual.x).toBeCloseTo(x, 6);
  expect(actual.y).toBeCloseTo(y, 6);
  expect(actual.z).toBeCloseTo(z, 6);
  expect(actual.w).toBeCloseTo(w, 6);
}

describe('quaternionFromAxisAngle', () => {
  it('sets the vector part to the axis times sin(angle / 2) and w to cos(angle / 2)', () => {
    expectQuaternion(TURN_ABOUT_Z, 0, 0, 0.24740396, 0.9689124);
  });

  it('gives the all-zero quaternion for a zero axis, as the Quaternion constructor does (edge case)', () => {
    expectQuaternion(quaternionFromAxisAngle({ x: 0, y: 0, z: 0 }, 1), 0, 0, 0, 0);
  });
});

describe('quaternionMultiply', () => {
  it('applies the right quaternion first, as Quaternion::operator* does', () => {
    expectQuaternion(
      quaternionMultiply(TURN_ABOUT_Z, TURN_ABOUT_X),
      0.78812844,
      0.20124222,
      0.1439107,
      0.5636
    );
  });
});

describe('quaternionInverse', () => {
  it('negates the vector part of a unit quaternion', () => {
    expectQuaternion(quaternionInverse(TURN_ABOUT_Z), 0, 0, -0.24740396, 0.9689124);
  });
});

describe('normalizedQuaternion', () => {
  it('divides the four components by the length', () => {
    expectQuaternion(
      normalizedQuaternion({ x: 0.2, y: 0.4, z: 0.1, w: 0.8 }),
      0.21693043,
      0.43386087,
      0.10846522,
      0.86772174
    );
  });
});

describe('quaternionSlerp', () => {
  it('turns a fraction of the way along the shorter arc', () => {
    expectQuaternion(quaternionSlerp(TURN_ABOUT_Z, TURN_ABOUT_X, 0.3), 0.28310537, 0, 0.18842825, 0.9403968);
  });

  it('interpolates linearly when the two quaternions nearly coincide (edge case)', () => {
    const nearly = quaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.5000001);
    const halfway = quaternionSlerp(TURN_ABOUT_Z, nearly, 0.5);
    expect(halfway.z).toBeCloseTo(TURN_ABOUT_Z.z, 6);
  });

  it('takes the shorter arc when the dot product is negative (edge case)', () => {
    const flipped = { x: -TURN_ABOUT_Z.x, y: -TURN_ABOUT_Z.y, z: -TURN_ABOUT_Z.z, w: -TURN_ABOUT_Z.w };
    const result = quaternionSlerp(TURN_ABOUT_Z, flipped, 0.5);
    expectQuaternion(result, 0, 0, TURN_ABOUT_Z.z, TURN_ABOUT_Z.w);
  });
});
