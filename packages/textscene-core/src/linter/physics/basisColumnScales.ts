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
 * Godot's `get_scale()` (basis.cpp:300-322) multiplies these magnitudes by a
 * single `det_sign`. That factor cancels out of a pairwise difference at ±1, so
 * the unsigned form is exact for the equality check the callers run — but NOT at
 * 0. `SIGN` is three-valued (typedefs.h:123-126), so a degenerate basis scales
 * to (0, 0, 0), which is uniform however unequal the magnitudes are.
 *
 * Null for an `inf`/`nan` component too: `parseTransform3D` matches the FINITE
 * grammar (`slotTupleRegex`) and throws on one. See
 * {@link basisColumnScalesGodotFloat} for the caller that needs those.
 */
export function basisColumnScales(raw: string): [number, number, number] | null {
  try {
    const { basis_x, basis_y, basis_z } = parseTransform3D(raw);
    // Exact, like `SIGN` itself: a determinant of 1e-30 signs to +1 in Godot and
    // really does have a scale, so an epsilon here would silence a live warning.
    const det = basisDeterminant(
      basis_x.x, basis_x.y, basis_x.z,
      basis_y.x, basis_y.y, basis_y.z,
      basis_z.x, basis_z.y, basis_z.z
    );
    if (det === 0) return [0, 0, 0];
    return [
      Math.hypot(basis_x.x, basis_y.x, basis_z.x),
      Math.hypot(basis_x.y, basis_y.y, basis_z.y),
      Math.hypot(basis_x.z, basis_y.z, basis_z.z),
    ];
  } catch {
    return null; // malformed literal is linterParser.ts's job, not this rule's
  }
}

/**
 * `Basis::determinant()` (basis.h:350-354) over the nine row-major components,
 * expanded along the first COLUMN exactly as the engine writes it.
 *
 * The grouping is transcribed rather than simplified. Expanding along the first
 * ROW is the same number for every finite basis and not for one carrying `inf`:
 * `Transform3D(1, inf, 0, 0, 1, 1, 1, 0, 1, …)` reaches `1 - 0*inf + 1*inf`
 * (NaN, signing to 0) one way and `1 + inf` (signing to +1) the other, which is
 * the difference between reporting Godot's scale and reporting one it never
 * holds.
 */
function basisDeterminant(
  a: number, b: number, c: number,
  d: number, e: number, f: number,
  g: number, h: number, i: number
): number {
  return a * (e * i - h * f) - d * (b * i - h * c) + g * (b * f - e * c);
}

const TRANSFORM3D_REGEX = makeFloatTupleRegex('Transform3D', 12);

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
