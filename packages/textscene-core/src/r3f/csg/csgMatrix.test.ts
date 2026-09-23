/**
 * `Transform3D` to `Matrix4`. `basis_x/y/z` are the matrix rows, so reading them as columns gives
 * the transpose, which is correct for identity and translation and wrong once anything rotates.
 * The evaluator bakes each contribution through this, so a transpose corrupts every boolean.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { transform3DToMatrix, matrixToTransform3D } from '../nodeTreeTransforms';
import { decomposeForR3F } from '../nodeTransform';
import type { Transform3D } from '../../nodes/base/node3d/types';

const IDENTITY: Transform3D = {
  basis_x: { x: 1, y: 0, z: 0 },
  basis_y: { x: 0, y: 1, z: 0 },
  basis_z: { x: 0, y: 0, z: 1 },
  origin: { x: 0, y: 0, z: 0 },
};

/** A 90-degree rotation about +Y as Godot serialises it, plus a translation. */
const ROTATED: Transform3D = {
  basis_x: { x: -4.37114e-8, y: 0, z: -1 },
  basis_y: { x: 0, y: 1, z: 0 },
  basis_z: { x: 1, y: 0, z: -4.37114e-8 },
  origin: { x: 2, y: 3, z: 4 },
};

describe('transform3DToMatrix', () => {
  it('puts the origin in the translation column', () => {
    const m = transform3DToMatrix({ ...IDENTITY, origin: { x: 2, y: 3, z: 4 } });
    expect(new THREE.Vector3().setFromMatrixPosition(m).toArray()).toEqual([2, 3, 4]);
  });

  it('agrees with the renderer’s own decomposition of the same transform', () => {
    // decomposeForR3F is what every node component already uses to place itself, so if
    // these two disagreed the evaluator would bake contributions somewhere other than
    // where the same node renders.
    const viaMatrix = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    transform3DToMatrix(ROTATED).decompose(viaMatrix, quaternion, scale);

    const direct = decomposeForR3F(ROTATED);
    expect(viaMatrix.toArray()).toEqual(direct.position);

    const euler = new THREE.Euler().setFromQuaternion(quaternion);
    expect(euler.x).toBeCloseTo(direct.rotation[0], 5);
    expect(euler.y).toBeCloseTo(direct.rotation[1], 5);
    expect(euler.z).toBeCloseTo(direct.rotation[2], 5);
  });

  it('treats basis_x as a ROW, so a rotation is not silently transposed', () => {
    // The C++ `Basis(x_axis, y_axis, z_axis)` sets columns, but the TSCN serialisation is row-major
    // and basis_x is the first row (utils/transform.ts). So M * (1,0,0) is the first column,
    // `(basis_x.x, basis_y.x, basis_z.x)`, which is +Z here. The transposed reading lands on -Z.
    const m = transform3DToMatrix({ ...ROTATED, origin: { x: 0, y: 0, z: 0 } });
    const v = new THREE.Vector3(1, 0, 0).applyMatrix4(m);
    expect(v.x).toBeCloseTo(0, 5);
    expect(v.z).toBeCloseTo(1, 5);
  });

  it('round-trips through matrixToTransform3D', () => {
    const back = matrixToTransform3D(transform3DToMatrix(ROTATED));
    expect(back.origin).toEqual(ROTATED.origin);
    expect(back.basis_x.z).toBeCloseTo(ROTATED.basis_x.z, 6);
    expect(back.basis_z.x).toBeCloseTo(ROTATED.basis_z.x, 6);
  });

  it('maps identity to identity', () => {
    expect(transform3DToMatrix(IDENTITY).equals(new THREE.Matrix4())).toBe(true);
  });
});
