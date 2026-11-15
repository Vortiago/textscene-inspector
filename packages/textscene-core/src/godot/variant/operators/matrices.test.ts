import { describe, expect, it } from 'vitest';
import { quaternionFromAxisAngle } from '../../math/quaternion.js';
import {
  divideTransform2D,
  quaternionXform,
  transform2DXformInv,
  transform3DXformAabb,
  transposeBasis,
} from './matrices.js';

const SCALE_AND_MOVE = { a: 2, b: 0, c: 0, d: 4, tx: 1, ty: 1 };

// Each expected value is Godot 4.6.3's operator on the same values.
describe('matrices', () => {
  it('carries a vector back through a Transform2D', () => {
    expect(transform2DXformInv(SCALE_AND_MOVE, { x: 3, y: 5 })).toEqual({ x: 4, y: 16 });
  });

  it('divides every column of a Transform2D', () => {
    expect(divideTransform2D(SCALE_AND_MOVE, 2)).toEqual({ a: 1, b: 0, c: 0, d: 2, tx: 0.5, ty: 0.5 });
  });

  it('rotates a vector with the float rounding of a quarter turn', () => {
    const quarterTurn = quaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2);
    expect(quaternionXform(quarterTurn, { x: 1, y: 0, z: 0 })).toEqual({
      x: Math.fround(5.9604645e-8),
      y: Math.fround(0.99999994),
      z: 0,
    });
  });

  it('moves an AABB with a Transform3D', () => {
    const transform = {
      basis_x: { x: 1, y: 0, z: 0 },
      basis_y: { x: 0, y: 1, z: 0 },
      basis_z: { x: 0, y: 0, z: 1 },
      origin: { x: 1, y: 2, z: 3 },
    };
    const box = { position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } };
    expect(transform3DXformAabb(transform, box)).toEqual({
      position: { x: 1, y: 2, z: 3 },
      size: { x: 1, y: 1, z: 1 },
    });
  });

  it('transposes the row-major components of a basis', () => {
    expect(transposeBasis([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual([1, 4, 7, 2, 5, 8, 3, 6, 9]);
  });
});
