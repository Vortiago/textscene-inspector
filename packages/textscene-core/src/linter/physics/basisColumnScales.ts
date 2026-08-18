/** Shared basis-column-scale helpers for the physics linter-rule factories. */

import { makeFloatTupleRegex } from '../validators/floatTupleValidator.js';
import { tupleComponent } from '../validators/commonValidators.js';
import { basisDeterminant, sign } from '../../godot/math.js';

const TRANSFORM3D_REGEX = makeFloatTupleRegex('Transform3D', 12);

/**
 * Basis-column magnitudes of a `Transform3D(...)` literal, or null when it does
 * not parse — collision_shape_3d.cpp:153, `get_transform().get_basis()`.
 * `parseTransform3D` returns Godot's Basis ROWS (utils/transform.ts docblock), so
 * column `i` is the `i`-th component picked from each of the three rows.
 *
 * Godot's `get_scale()` (basis.cpp:300-322) multiplies these magnitudes by a
 * single `det_sign`. That factor cancels out of a pairwise difference at ±1, so
 * the unsigned form is exact for the equality check the callers run — but NOT at
 * 0. `SIGN` is three-valued (typedefs.h:123-126), so a degenerate basis scales
 * to (0, 0, 0), which is uniform however unequal the magnitudes are.
 *
 * Read through the LINTER's float grammar, so an `inf`/`nan` component reaches
 * it: `parseTransform3D` matches the finite grammar and throws on one, and the
 * callers then said nothing at all about a basis Godot reads a scale off.
 */
export function basisColumnScales(raw: string): [number, number, number] | null {
  const match = TRANSFORM3D_REGEX.exec(raw);
  // A malformed literal is linterParser.ts's job, not this rule's.
  if (!match) return null;
  const n = match.slice(1, 10).map(tupleComponent);
  // Exact, like `SIGN` itself: a determinant of 1e-30 signs to +1 in Godot and
  // really does have a scale, so an epsilon here would silence a live warning.
  const det = basisDeterminant(n[0]!, n[1]!, n[2]!, n[3]!, n[4]!, n[5]!, n[6]!, n[7]!, n[8]!);
  if (det === 0) return [0, 0, 0];
  return [
    Math.hypot(n[0]!, n[3]!, n[6]!),
    Math.hypot(n[1]!, n[4]!, n[7]!),
    Math.hypot(n[2]!, n[5]!, n[8]!),
  ];
}

/**
 * The same basis columns as {@link basisColumnScales}, parsed with Godot's own
 * float grammar (`TSCN_FLOAT_PATTERN_SOURCE`, via
 * `makeFloatTupleRegex`/`tupleComponent`) rather than `parseTransform3D`, and
 * signed by the determinant.
 *
 * `parseTransform3D` matches the FINITE grammar and throws on `inf`/`-inf`/`nan`,
 * so {@link basisColumnScales} reads a basis carrying one as unparseable and its
 * callers say nothing at all. Godot reads a scale off it either way, which
 * `rigid_body_3d.cpp:666`'s `abs(scale.axis - 1.0) > 0.05` then warns about.
 *
 * What it reads is not a per-axis magnitude: `get_scale()` is
 * `SIGN(determinant()) * get_scale_abs()` (basis.cpp:321-322), so ONE non-finite
 * component reaches all three axes. `SIGN` takes neither of its comparisons on a
 * NaN determinant and returns 0 (typedefs.h:123-126), which leaves the `nan` axis
 * NaN — comparing FALSE against 1.0 — and collapses the other two to exact 0,
 * a whole unit outside the tolerance. The warning fires, from the axes that did
 * NOT carry the `nan`.
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
  return sign(basisDeterminant(a, b, c, d, e, f, g, h, i));
}
