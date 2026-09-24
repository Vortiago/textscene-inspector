/** Shared basis-column-scale helpers for the physics linter-rule factories. */

import { transform3DBasis } from '../transformBasis.js';
import { basisGetScale, basisGetScaleAbs } from '../../godot/basis.js';
import { basisDeterminant } from '../../godot/math.js';

/**
 * Basis-column magnitudes of a `Transform3D(...)` literal, or null when it does
 * not parse: collision_shape_3d.cpp:153, `get_transform().get_basis()`. Godot's
 * `get_scale()` (basis.cpp:300-322) multiplies them by one `det_sign`, which
 * cancels from the callers' pairwise difference at ±1, but not at 0.
 */
export function basisColumnScales(raw: string): [number, number, number] | null {
  const n = transform3DBasis(raw);
  // A malformed literal is linterParser.ts's job, not this rule's.
  if (n === null) return null;
  // `SIGN` is three-valued (typedefs.h:123-126), so a degenerate basis scales to
  // (0, 0, 0), uniform however unequal the magnitudes are. Exact, like `SIGN`: a
  // determinant of 1e-30 signs to +1 and has a scale, so an epsilon would silence
  // a live warning.
  const det = basisDeterminant(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], n[8]);
  if (det === 0) return [0, 0, 0];
  return basisGetScaleAbs(n);
}

/**
 * The same basis, read as `Basis::get_scale()` (basis.cpp:321-322): signed by the
 * determinant, for `rigid_body_3d.cpp:666`'s per-axis `abs(scale.axis - 1.0) > 0.05`.
 * A mirrored basis (determinant -1) reads (-1, -1, -1) there and warns on all three
 * axes, where {@link basisColumnScales} reads (1, 1, 1) and says nothing.
 */
export function basisColumnScalesGodotFloat(raw: string): [number, number, number] | null {
  const n = transform3DBasis(raw);
  // A NaN determinant signs to 0: the `nan` axis stays NaN and the other two drop
  // to 0, a whole unit outside the tolerance, so the warning still fires.
  // `rigid_body_2d.cpp:647` tests `t.columns[i].length()`, a magnitude, so the 2D
  // rule stays unsigned. The asymmetry is Godot's.
  return n === null ? null : basisGetScale(n);
}
