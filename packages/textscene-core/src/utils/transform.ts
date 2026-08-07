/**
 * Transform utilities for parsing and decomposing Transform3D matrices.
 */

import type { Transform3D, DecomposedTransform } from '../nodes/base/node3d/types';
import { warn } from '../logger';
import { isEqualApprox } from '../godot/math.js';

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
 * Dependency-free replication of three.js r184's decomposition path
 * (`Matrix4.decompose` → `Quaternion.setFromRotationMatrix` →
 * `Euler.setFromQuaternion(q, 'XYZ')`), op-for-op in the same evaluation
 * order so results are bit-identical to the previous three.js-backed
 * implementation — pinned by `transform.threeEquivalence.test.ts`. This
 * keeps the parser layer free of any `three` value-import (guarded by
 * reactFree.test.ts and the vscode app's webExtensionSafe.test.ts).
 *
 * The Euler order is XYZ, matching `THREE.Object3D.rotation` defaults so
 * values can be applied directly to `<group rotation={...}>`. Reflections
 * (negative determinant) fold the sign into `scale.x`, three.js convention.
 *
 * Convention: Godot stores Basis as `Vector3 rows[3]`. The parsed
 * `basis_x`, `basis_y`, `basis_z` ARE the three rows of the 3×3 matrix
 * (NOT columns — earlier code mistakenly transposed by treating them
 * as columns, see commit history around b4ccaab regression
 * and 401f8f5 fix that documented the row interpretation). Columns —
 * what per-axis scale is measured along — are therefore
 * `(basis_x.c, basis_y.c, basis_z.c)`.
 */
export function decomposeTransform3D(
  transform: Transform3D
): DecomposedTransform {
  const { basis_x, basis_y, basis_z, origin } = transform;

  const position = { x: origin.x, y: origin.y, z: origin.z };

  // Basis determinant, cofactor expansion along the first row.
  const det =
    basis_x.x * (basis_y.y * basis_z.z - basis_y.z * basis_z.y) -
    basis_x.y * (basis_y.x * basis_z.z - basis_y.z * basis_z.x) +
    basis_x.z * (basis_y.x * basis_z.y - basis_y.y * basis_z.x);

  // Degenerate basis: identity rotation and unit scale (three.js behavior).
  let sx = 1;
  let sy = 1;
  let sz = 1;
  let qx = 0;
  let qy = 0;
  let qz = 0;
  let qw = 1;

  if (det !== 0) {
    // Per-axis scale = column lengths.
    sx = Math.sqrt(
      basis_x.x * basis_x.x + basis_y.x * basis_y.x + basis_z.x * basis_z.x
    );
    sy = Math.sqrt(
      basis_x.y * basis_x.y + basis_y.y * basis_y.y + basis_z.y * basis_z.y
    );
    sz = Math.sqrt(
      basis_x.z * basis_x.z + basis_y.z * basis_y.z + basis_z.z * basis_z.z
    );
    if (det < 0) sx = -sx;

    // Normalize columns to a pure rotation matrix (m_rc = row r, column c).
    const invSX = 1 / sx;
    const invSY = 1 / sy;
    const invSZ = 1 / sz;
    const m11 = basis_x.x * invSX;
    const m12 = basis_x.y * invSY;
    const m13 = basis_x.z * invSZ;
    const m21 = basis_y.x * invSX;
    const m22 = basis_y.y * invSY;
    const m23 = basis_y.z * invSZ;
    const m31 = basis_z.x * invSX;
    const m32 = basis_z.y * invSY;
    const m33 = basis_z.z * invSZ;

    // Rotation matrix → quaternion (trace branching, Shepperd's method).
    const trace = m11 + m22 + m33;
    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      qw = 0.25 / s;
      qx = (m32 - m23) * s;
      qy = (m13 - m31) * s;
      qz = (m21 - m12) * s;
    } else if (m11 > m22 && m11 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
      qw = (m32 - m23) / s;
      qx = 0.25 * s;
      qy = (m12 + m21) / s;
      qz = (m13 + m31) / s;
    } else if (m22 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
      qw = (m13 - m31) / s;
      qx = (m12 + m21) / s;
      qy = 0.25 * s;
      qz = (m23 + m32) / s;
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
      qw = (m21 - m12) / s;
      qx = (m13 + m31) / s;
      qy = (m23 + m32) / s;
      qz = 0.25 * s;
    }
  }

  // Quaternion → unit rotation matrix (re-orthogonalized — this round-trip
  // is what makes gimbal handling stable for float32-serialized bases).
  const x2 = qx + qx;
  const y2 = qy + qy;
  const z2 = qz + qz;
  const xx = qx * x2;
  const xy = qx * y2;
  const xz = qx * z2;
  const yy = qy * y2;
  const yz = qy * z2;
  const zz = qz * z2;
  const wx = qw * x2;
  const wy = qw * y2;
  const wz = qw * z2;

  const e11 = 1 - (yy + zz);
  const e12 = xy - wz;
  const e13 = xz + wy;
  const e22 = 1 - (xx + zz);
  const e23 = yz - wx;
  const e32 = yz + wx;
  const e33 = 1 - (xx + yy);

  // Euler extraction, XYZ order, with the gimbal-lock singularity branch.
  const ry = Math.asin(Math.max(-1, Math.min(1, e13)));
  let rx: number;
  let rz: number;
  if (Math.abs(e13) < 0.9999999) {
    rx = Math.atan2(-e23, e33);
    rz = Math.atan2(-e12, e11);
  } else {
    rx = Math.atan2(e32, e22);
    rz = 0;
  }

  return {
    position,
    rotation: { x: rx, y: ry, z: rz },
    scale: { x: sx, y: sy, z: sz },
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

/**
 * Whether a serialised `Transform3D`'s scale differs from `(1, 1, 1)`.
 *
 * Godot asks this in several unrelated configuration warnings —
 * `Light3D`'s "a light's scale does not affect the visual size of the light"
 * (`light_3d.cpp:183`) and `XROrigin3D`'s "changing the scale is not supported"
 * (`xr_nodes.cpp:698`) among them — always as
 * `!get_scale().is_equal_approx(Vector3(1, 1, 1))` on the node's OWN local
 * transform, never a composed global one.
 *
 * A malformed literal answers `false`: rejecting it is the strict parser's job,
 * and a semantic rule that also complained would report one defect twice.
 */
export function hasNonUnitScale3D(rawTransform: string | undefined): boolean {
  if (rawTransform === undefined) return false;
  try {
    const { scale } = decomposeTransform3D(parseTransform3D(rawTransform));
    return !isEqualApprox(scale.x, 1) || !isEqualApprox(scale.y, 1) || !isEqualApprox(scale.z, 1);
  } catch {
    return false;
  }
}
