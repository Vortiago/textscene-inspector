/** Shared basis-column-scale helpers for the physics linter-rule factories. */

import { parseTransform3D } from '../../utils/transform.js';
import { makeFloatTupleRegex } from '../validators/floatTupleValidator.js';
import { tupleComponent } from '../validators/commonValidators.js';
import { sign } from '../../godot/math.js';

/**
 * Basis-column magnitudes of a `Transform3D(...)` literal, or null when it does
 * not parse — collision_shape_3d.cpp:153, `get_transform().get_basis()`.
 * `parseTransform3D` returns Godot's Basis ROWS (utils/transform.ts docblock), so
 * column `i` is the `i`-th component picked from each of the three rows.
 *
 * Godot's `get_scale()` (basis.cpp:300-321) multiplies these magnitudes by a
 * single `det_sign`. That factor cancels out of a pairwise difference at ±1, so
 * the unsigned form is exact for the equality check the callers run — but NOT at
 * 0. `SIGN` is three-valued (typedefs.h:123-126), so a degenerate basis scales
 * to (0, 0, 0), which is uniform however unequal the magnitudes are.
 *
 * Does NOT handle `inf`/`nan` components — see
 * {@link basisColumnScalesGodotFloat} for the caller that needs to.
 */
export function basisColumnScales(raw: string): [number, number, number] | null {
  try {
    const { basis_x, basis_y, basis_z } = parseTransform3D(raw);
    // Exact, like `SIGN` itself: a determinant of 1e-30 signs to +1 in Godot and
    // really does have a scale, so an epsilon here would silence a live warning.
    if (determinantOfRows(basis_x, basis_y, basis_z) === 0) return [0, 0, 0];
    return [
      Math.hypot(basis_x.x, basis_y.x, basis_z.x),
      Math.hypot(basis_x.y, basis_y.y, basis_z.y),
      Math.hypot(basis_x.z, basis_y.z, basis_z.z),
    ];
  } catch {
    return null; // malformed literal is linterParser.ts's job, not this rule's
  }
}

/** `Basis::determinant()` (basis.h:350-354) over the three parsed rows. */
function determinantOfRows(
  r0: { x: number; y: number; z: number },
  r1: { x: number; y: number; z: number },
  r2: { x: number; y: number; z: number }
): number {
  return (
    r0.x * (r1.y * r2.z - r2.y * r1.z) -
    r1.x * (r0.y * r2.z - r2.y * r0.z) +
    r2.x * (r0.y * r1.z - r1.y * r0.z)
  );
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
  const axisSign = detSign(n as number[]);
  return [axisSign * col(0), axisSign * col(1), axisSign * col(2)];
}

/**
 * `SIGN(determinant())` as `Basis::get_scale` applies it (basis.cpp:321-322),
 * which is +1, -1, or 0 exactly (`SIGN`, typedefs.h:124-126).
 *
 * SIGNED, unlike {@link basisColumnScales}, and the difference is only invisible
 * where it cancels. It cancels in a PAIRWISE comparison, which is why the
 * non-uniform-scale rules are right to ignore it; it does NOT cancel in
 * `rigid_body_3d.cpp:666`'s `abs(scale.axis - 1.0) > 0.05`, which compares each
 * axis against a constant. A mirrored basis such as
 * `Transform3D(-1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)` has determinant -1, so
 * Godot reads its scale as (-1, -1, -1) and warns on all three axes while the
 * unsigned magnitudes read (1, 1, 1) and say nothing. A degenerate basis gives
 * sign 0, hence scale (0, 0, 0), which warns — matching the engine.
 *
 * `rigid_body_2d.cpp:647` has no equivalent: it tests `t.columns[i].length()`,
 * a magnitude, so the 2D rule stays unsigned. The asymmetry is Godot's.
 */
function detSign(n: number[]): number {
  const [a, b, c, d, e, f, g, h, i] = n as [
    number, number, number, number, number, number, number, number, number,
  ];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return sign(det);
}
