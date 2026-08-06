/** Shared basis-column-scale helper for the physics linter-rule factories. */

import { parseTransform3D } from '../../utils/transform.js';

/**
 * Unsigned basis-column magnitudes of a `Transform3D(...)` literal, or null when
 * it does not parse — collision_shape_3d.cpp:153, `get_transform().get_basis()`.
 * `parseTransform3D` returns Godot's Basis ROWS (utils/transform.ts docblock), so
 * column `i` is the `i`-th component picked from each of the three rows.
 *
 * Godot's actual `get_scale()` (basis.cpp:300-321) multiplies these magnitudes
 * by a single `det_sign` shared across all three axes, which cancels out of
 * every pairwise difference below — so the unsigned form is exact for this
 * equality check, never an approximation of it.
 */
export function basisColumnScales(raw: string): [number, number, number] | null {
  try {
    const { basis_x, basis_y, basis_z } = parseTransform3D(raw);
    return [
      Math.hypot(basis_x.x, basis_y.x, basis_z.x),
      Math.hypot(basis_x.y, basis_y.y, basis_z.y),
      Math.hypot(basis_x.z, basis_y.z, basis_z.z),
    ];
  } catch {
    return null; // malformed literal is linterParser.ts's job, not this rule's
  }
}
