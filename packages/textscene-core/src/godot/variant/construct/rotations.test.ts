import { describe, expect, it } from 'vitest';
import { QUATERNION_IDENTITY } from '../../math/quaternion.js';
import {
  checkedQuaternionFromAxisAngle,
  planeFromNormalPoint,
  planeFromPoints,
  quaternionArc,
  transform2DFromParts,
  transform2DFromRotation,
} from './rotations.js';

const HALF_SQRT2 = Math.SQRT1_2;

describe('transform2DFromRotation', () => {
  it('writes the rotation into the columns and keeps the position', () => {
    const { a, b, c, d, tx, ty } = transform2DFromRotation(Math.PI / 2, { x: 3, y: 4 });
    expect([a, b, c, d, tx, ty].map((value) => Math.round(value))).toEqual([0, 1, -1, 0, 3, 4]);
  });

  it('keeps the -0 of `-sin(0)`', () => {
    expect(transform2DFromRotation(0, { x: 0, y: 0 }).c).toBe(-0);
  });
});

describe('transform2DFromParts', () => {
  it('scales each column', () => {
    expect(transform2DFromParts(0, { x: 2, y: 3 }, 0, { x: 5, y: 6 })).toEqual({
      a: 2,
      b: 0,
      c: -0,
      d: 3,
      tx: 5,
      ty: 6,
    });
  });

  it('turns the y column by the skew', () => {
    const { c, d } = transform2DFromParts(0, { x: 1, y: 1 }, Math.PI / 2, { x: 0, y: 0 });
    expect([c, d]).toEqual([-1, expect.closeTo(0, 6)]);
  });
});

describe('checkedQuaternionFromAxisAngle', () => {
  it('turns about a unit axis', () => {
    const q = checkedQuaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2);
    expect([q.x, q.y, q.z, q.w]).toEqual([
      0,
      0,
      expect.closeTo(HALF_SQRT2, 6),
      expect.closeTo(HALF_SQRT2, 6),
    ]);
  });

  it('refuses an axis that is not normalised with Quaternion()', () => {
    expect(checkedQuaternionFromAxisAngle({ x: 0, y: 0, z: 2 }, 1)).toEqual(QUATERNION_IDENTITY);
  });

  it('takes an axis within UNIT_EPSILON of unit length squared', () => {
    const axis = { x: 0, y: 0, z: Math.sqrt(1.0009) };
    expect(checkedQuaternionFromAxisAngle(axis, 1)).not.toEqual(QUATERNION_IDENTITY);
  });
});

describe('quaternionArc', () => {
  it('turns x to y about z', () => {
    const q = quaternionArc({ x: 1, y: 0, z: 0 }, { x: 0, y: 2, z: 0 });
    expect([q.x, q.y, q.z, q.w]).toEqual([
      0,
      0,
      expect.closeTo(HALF_SQRT2, 6),
      expect.closeTo(HALF_SQRT2, 6),
    ]);
  });

  it('turns half a turn about a perpendicular for opposite vectors', () => {
    expect(quaternionArc({ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 1, w: 0 });
  });

  it('gives Quaternion() for parallel vectors', () => {
    expect(quaternionArc({ x: 0, y: 3, z: 0 }, { x: 0, y: 1, z: 0 })).toEqual(QUATERNION_IDENTITY);
  });

  it('refuses a zero vector with Quaternion()', () => {
    expect(quaternionArc({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toEqual(QUATERNION_IDENTITY);
  });
});

describe('planeFromNormalPoint', () => {
  it('gives the distance of the point along the normal', () => {
    expect(planeFromNormalPoint({ x: 0, y: 1, z: 0 }, { x: 7, y: 5, z: 2 })).toEqual({
      normal: { x: 0, y: 1, z: 0 },
      d: 5,
    });
  });

  it('keeps a normal that is not normalised, as Godot does', () => {
    expect(planeFromNormalPoint({ x: 0, y: 2, z: 0 }, { x: 0, y: 5, z: 0 }).d).toBe(10);
  });
});

describe('planeFromPoints', () => {
  it('faces the side the points turn clockwise from', () => {
    expect(planeFromPoints({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 0, y: 1, z: 1 })).toEqual({
      normal: { x: -0, y: -0, z: -1 },
      d: -1,
    });
  });

  it('gives a zero normal for points on one line', () => {
    const plane = planeFromPoints({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 });
    expect(plane.normal).toEqual({ x: 0, y: 0, z: 0 });
  });
});
