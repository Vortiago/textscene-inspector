/**
 * Transform utilities for decomposing Transform3D matrices.
 */

import * as THREE from 'three';
import type { Transform3D, DecomposedTransform } from '../nodes/base/node3d/types';
import { warn } from '../logger';

/**
 * Parse Transform3D from string format.
 * Example: "Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)"
 */
export function parseTransform3D(transformString: string): Transform3D {
  const match = transformString.match(/Transform3D\(([\d\s.,e+-]+)\)/);
  if (!match || !match[1]) {
    throw new Error(`Invalid Transform3D format: ${transformString}`);
  }

  const values = match[1]
    .split(',')
    .map((v) => parseFloat(v.trim()))
    .filter((v) => !isNaN(v));

  if (values.length !== 12) {
    throw new Error(
      `Transform3D must have 12 values, got ${values.length}: ${transformString}`
    );
  }

  const [
    bx_x, bx_y, bx_z,
    by_x, by_y, by_z,
    bz_x, bz_y, bz_z,
    o_x, o_y, o_z
  ] = values as [number, number, number, number, number, number, number, number, number, number, number, number];

  return {
    basis_x: { x: bx_x, y: bx_y, z: bx_z },
    basis_y: { x: by_x, y: by_y, z: by_z },
    basis_z: { x: bz_x, y: bz_y, z: bz_z },
    origin: { x: o_x, y: o_y, z: o_z },
  };
}

/**
 * Decompose Transform3D matrix into position, rotation, and scale.
 *
 * Godot stores the basis column-major: `basis_x`, `basis_y`, `basis_z` are
 * the three columns of the 3×3 rotation+scale matrix. We pack those into a
 * THREE.Matrix4 (whose `.set()` argument order is row-major, matching
 * Godot's row-vector storage) and let THREE's well-tested `decompose()`
 * do the work. The resulting THREE.Euler is XYZ order, matching
 * `THREE.Object3D.rotation` defaults so values can be applied directly
 * to `<group rotation={...}>`.
 *
 * Convention: Godot stores Basis as `Vector3 rows[3]`. The parsed
 * `basis_x`, `basis_y`, `basis_z` ARE the three rows of the 3×3 matrix
 * (NOT columns — earlier code mistakenly transposed by treating them
 * as columns, see commit history around b4ccaab / WI-R3F-10 regression
 * and 401f8f5 fix that documented the row interpretation).
 */
export function decomposeTransform3D(
  transform: Transform3D
): DecomposedTransform {
  const { basis_x, basis_y, basis_z, origin } = transform;
  const m = new THREE.Matrix4().set(
    basis_x.x, basis_x.y, basis_x.z, origin.x,
    basis_y.x, basis_y.y, basis_y.z, origin.y,
    basis_z.x, basis_z.y, basis_z.z, origin.z,
    0, 0, 0, 1
  );

  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  m.decompose(pos, quat, sc);

  const euler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');

  return {
    position: { x: pos.x, y: pos.y, z: pos.z },
    rotation: { x: euler.x, y: euler.y, z: euler.z },
    scale: { x: sc.x, y: sc.y, z: sc.z },
  };
}

export function identityTransform3D(): Transform3D {
  return {
    basis_x: { x: 1, y: 0, z: 0 },
    basis_y: { x: 0, y: 1, z: 0 },
    basis_z: { x: 0, y: 0, z: 1 },
    origin: { x: 0, y: 0, z: 0 },
  };
}

/**
 * Parse optional transform property with error handling.
 * Returns undefined if no transform string provided.
 * Returns identity transform if parsing fails (with warning logged).
 */
export function parseOptionalTransform(
  transformString: string | undefined,
  nodeName: string
): Transform3D | undefined {
  if (!transformString) {
    return undefined;
  }

  try {
    return parseTransform3D(transformString);
  } catch (error) {
    warn(
      `Failed to parse transform for node "${nodeName}": ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return identityTransform3D();
  }
}
