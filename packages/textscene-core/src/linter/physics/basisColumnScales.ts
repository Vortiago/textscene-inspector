/** Shared basis-column-scale helpers for the physics linter-rule factories. */

import { transform3DBasis } from '../transformBasis.js';
import { basisGetScale, basisGetScaleAbs } from '../../godot/basis.js';
import { basisDeterminant } from '../../godot/math.js';

/**
 * Basis-column magnitudes of a `Transform3D(...)` literal, or null when it does
 * not parse — collision_shape_3d.cpp:153, `get_transform().get_basis()`.
 *
 * Godot's `get_scale()` (basis.cpp:300-322) multiplies these magnitudes by a
 * single `det_sign`. That factor cancels out of a pairwise difference at ±1, so
 * the unsigned form is exact for the equality check the callers run — but NOT at
 * 0. `SIGN` is three-valued (typedefs.h:123-126), so a degenerate basis scales
 * to (0, 0, 0), which is uniform however unequal the magnitudes are.
 */
export function basisColumnScales(raw: string): [number, number, number] | null {
  const n = transform3DBasis(raw);
  // A malformed literal is linterParser.ts's job, not this rule's.
  if (n === null) return null;
  // Exact, like `SIGN` itself: a determinant of 1e-30 signs to +1 in Godot and
  // really does have a scale, so an epsilon here would silence a live warning.
  const det = basisDeterminant(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], n[8]);
  if (det === 0) return [0, 0, 0];
  return basisGetScaleAbs(n);
}

/**
 * The same basis, read as `Basis::get_scale()` itself (basis.cpp:321-322) —
 * SIGNED by the determinant, with no degenerate special case.
 *
 * The difference from {@link basisColumnScales} is only invisible where the
 * shared `det_sign` cancels. It cancels in a PAIRWISE comparison, which is why
 * the non-uniform-scale rules are right to ignore it; it does NOT cancel in
 * `rigid_body_3d.cpp:666`'s `abs(scale.axis - 1.0) > 0.05`, which compares each
 * axis against a constant. A mirrored basis such as
 * `Transform3D(-1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)` has determinant -1, so
 * Godot reads its scale as (-1, -1, -1) and warns on all three axes while the
 * unsigned magnitudes read (1, 1, 1) and say nothing.
 *
 * It is also what keeps a `nan` component reportable: `SIGN` takes neither of
 * its comparisons on a NaN determinant and returns 0, which leaves the `nan`
 * axis NaN — comparing FALSE against 1.0 — and collapses the other two to exact
 * 0, a whole unit outside the tolerance. The warning fires, from the axes that
 * did NOT carry the `nan`.
 *
 * `rigid_body_2d.cpp:647` has no equivalent: it tests `t.columns[i].length()`,
 * a magnitude, so the 2D rule stays unsigned. The asymmetry is Godot's.
 */
export function basisColumnScalesGodotFloat(raw: string): [number, number, number] | null {
  const n = transform3DBasis(raw);
  return n === null ? null : basisGetScale(n);
}
