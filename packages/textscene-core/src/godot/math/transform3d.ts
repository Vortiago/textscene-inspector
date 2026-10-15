/** Godot's `Transform3D` (`core/math/transform_3d.h`) as plain components. */

import type { Vector3 } from './vector.js';

/**
 * A 3D transform, written `Transform3D(basis_x.xyz, basis_y.xyz, basis_z.xyz, origin.xyz)`.
 * Godot stores Basis as `Vector3 rows[3]`: basis_x, basis_y and basis_z are the rows of the 3×3
 * matrix, not the columns (utils/transform.ts has the convention), and origin is the fourth column.
 */
export interface Transform3D {
  basis_x: Vector3;
  basis_y: Vector3;
  basis_z: Vector3;
  origin: Vector3;
}

/**
 * A fresh `Transform3D()`: the identity rows `Basis` initialises (`core/math/basis.h:41-45`) and a
 * zero origin (`transform_3d.h:44`). Fresh, so a caller may mutate it.
 */
export function identityTransform3D(): Transform3D {
  return {
    basis_x: { x: 1, y: 0, z: 0 },
    basis_y: { x: 0, y: 1, z: 0 },
    basis_z: { x: 0, y: 0, z: 1 },
    origin: { x: 0, y: 0, z: 0 },
  };
}
