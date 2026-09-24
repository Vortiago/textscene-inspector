/**
 * Parses and decomposes Transform3D literals.
 */

import type { Transform3D, DecomposedTransform } from '../nodes/base/node3d/types';
import { warn } from '../logger';
import { slotTupleRegex, matchedFloat, allFinite } from '../godot/number.js';

const TRANSFORM3D_RE = slotTupleRegex('Transform3D', 12);
const CALL_PREFIX = 'Transform3D(';

/**
 * A `Transform3D(…)` literal of 12 components. Arity reports apart from grammar: six components
 * are a Transform2D pasted into a 3D slot, while a component that will not parse is a typo.
 */
export function parseTransform3D(transformString: string): Transform3D {
  const match = TRANSFORM3D_RE.exec(transformString);
  if (!match) {
    const trimmed = transformString.trim();
    if (trimmed.startsWith(CALL_PREFIX) && trimmed.endsWith(')')) {
      const count = trimmed.slice(CALL_PREFIX.length, -1).split(',').length;
      if (count !== 12) {
        throw new Error(`Transform3D must have 12 values, got ${count}: ${transformString}`);
      }
    }
    throw new Error(`Invalid Transform3D format: ${transformString}`);
  }

  const components = match.slice(1).map((v) => matchedFloat(v));
  // An overflowing exponent passes the grammar, and an Infinity decomposes to a NaN rotation that
  // drops the node and its descendants, so it takes a refused literal's path.
  if (!allFinite(components)) {
    throw new Error(`Non-finite Transform3D: ${transformString}`);
  }
  const [bx_x, bx_y, bx_z, by_x, by_y, by_z, bz_x, bz_y, bz_z, o_x, o_y, o_z] = components as [
    number, number, number, number, number, number, number, number, number, number, number, number,
  ];

  return {
    basis_x: { x: bx_x, y: bx_y, z: bx_z },
    basis_y: { x: by_x, y: by_y, z: by_z },
    basis_z: { x: bz_x, y: bz_y, z: bz_z },
    origin: { x: o_x, y: o_y, z: o_z },
  };
}

/**
 * Position, XYZ Euler rotation (as `<group rotation={...}>` takes it) and scale, op-for-op as
 * three.js r184's `Matrix4.decompose` path, so results are bit-identical
 * (`transform.threeEquivalence.test.ts`) while the parser layer imports no `three` value
 * (reactFree.test.ts, webExtensionSafe.test.ts).
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
    // Godot stores Basis as `Vector3 rows[3]`, so basis_x, basis_y and basis_z are rows, and each
    // axis scale is a column's length.
    sx = Math.sqrt(
      basis_x.x * basis_x.x + basis_y.x * basis_y.x + basis_z.x * basis_z.x
    );
    sy = Math.sqrt(
      basis_x.y * basis_x.y + basis_y.y * basis_y.y + basis_z.y * basis_z.y
    );
    sz = Math.sqrt(
      basis_x.z * basis_x.z + basis_y.z * basis_y.z + basis_z.z * basis_z.z
    );
    // A reflection folds its sign into scale.x, as three.js does.
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

  // Quaternion back to a unit rotation matrix: the round-trip re-orthogonalises, which keeps gimbal
  // handling stable for float32-serialised bases.
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
 * Undefined for an absent transform, and identity with a logged warning for a malformed one.
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
