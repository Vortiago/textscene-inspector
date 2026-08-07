/** Shared basis-column-scale helpers for the physics linter-rule factories. */

import { parseTransform3D } from '../../utils/transform.js';
import { makeFloatTupleRegex } from '../validators/floatTupleValidator.js';
import { tupleComponent } from '../validators/commonValidators.js';

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
 *
 * Does NOT handle `inf`/`nan` components — see
 * {@link basisColumnScalesGodotFloat} for the caller that needs to.
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

const TRANSFORM3D_REGEX = makeFloatTupleRegex('Transform3D', 12);

/**
 * The same basis-column magnitudes as {@link basisColumnScales}, but parsed
 * with Godot's own float grammar (`TSCN_FLOAT_PATTERN_SOURCE`, via
 * `makeFloatTupleRegex`/`tupleComponent`) rather than `parseTransform3D`.
 *
 * `parseTransform3D`'s regex (`[\d\s.,e+-]+`) cannot match `inf`/`-inf`/`nan`,
 * and its `.filter(v => !isNaN(v))` silently DROPS a component its narrower
 * grammar cannot read rather than failing — which shifts every value after it
 * into the wrong slot instead of raising. That is invisible to
 * `collisionshape3d-non-uniform-scale`'s pairwise equality test (an infinite
 * OR a dropped-and-shifted component both tend to compare unequal, so it still
 * warns), but `rigid_body_3d.cpp:667`'s `abs(scale.axis - 1) > 0.05` needs the
 * distinction Godot itself draws: TRUE for an infinite column, FALSE for a
 * `nan` one (every comparison against NaN is false) — a rule built on the
 * narrower parser cannot reproduce that split.
 */
export function basisColumnScalesGodotFloat(raw: string): [number, number, number] | null {
  const match = TRANSFORM3D_REGEX.exec(raw);
  if (!match) return null;
  const n = match.slice(1, 10).map(tupleComponent);
  const col = (i: number): number => Math.hypot(n[i]!, n[i + 3]!, n[i + 6]!);
  return [col(0), col(1), col(2)];
}
