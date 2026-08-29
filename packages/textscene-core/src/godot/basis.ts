/**
 * `Basis` (`core/math/basis.cpp`), over the nine components a `Transform3D`
 * literal spells.
 *
 * The writer emits `m3.rows[i][j]` for `i`, `j` in 0..2 before the origin
 * (`variant_parser.cpp:2114-2121`), so the components are ROW-major and column
 * `i` is `(n[i], n[i + 3], n[i + 6])`.
 *
 * Here rather than beside a rule because Godot asks these two questions of a
 * serialised transform from four unrelated places — `Light3D` and `XROrigin3D`
 * scale warnings, `OpenXRCompositionLayer` orthonormality, `RigidBody3D` scale
 * — and each answer is a fact about the engine, not about a diagnostic.
 */

import { basisDeterminant, isEqualApprox, isZeroApprox, sign } from './math.js';

/** The nine row-major components of a serialised `Basis`. */
export type BasisComponents = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

/** Column `index` of the basis, the vector `Basis::get_column` returns. */
function column(n: BasisComponents, index: number): [number, number, number] {
  return [n[index]!, n[index + 3]!, n[index + 6]!];
}

function dot(a: readonly number[], b: readonly number[]): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}

/**
 * `Basis::get_scale_abs()` (basis.cpp:287-292): the three COLUMN magnitudes,
 * unsigned.
 */
export function basisGetScaleAbs(n: BasisComponents): [number, number, number] {
  return [
    Math.hypot(n[0], n[3], n[6]),
    Math.hypot(n[1], n[4], n[7]),
    Math.hypot(n[2], n[5], n[8]),
  ];
}

/**
 * `Basis::get_scale()` (basis.cpp:321-322): `SIGN(determinant()) *
 * get_scale_abs()`, the value every `!get_scale().is_equal_approx(Vector3(1, 1,
 * 1))` configuration warning reads.
 *
 * The sign reaches all three axes, so a mirrored basis scales to (-1, -1, -1)
 * and a DEGENERATE one to (0, 0, 0) — `SIGN` is three-valued
 * (typedefs.h:123-126). It takes neither of its comparisons on a NaN
 * determinant and returns 0 too, which leaves the NaN axis NaN (`0 * nan`) and
 * collapses the others to exact 0.
 */
export function basisGetScale(n: BasisComponents): [number, number, number] {
  const detSign = sign(basisDeterminant(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], n[8]));
  const abs = basisGetScaleAbs(n);
  return [detSign * abs[0], detSign * abs[1], detSign * abs[2]];
}

/**
 * Whether `get_scale()` is `(1, 1, 1)` to Godot's tolerance —
 * `Vector3::is_equal_approx` (vector3.cpp:141-143) component by component, in
 * the engine's operand order, since `Math::is_equal_approx`'s tolerance is
 * relative to its LEFT operand.
 *
 * A non-finite axis is not unit: `is_equal_approx(inf, 1)` fails the exact
 * branch and then compares `inf < inf`, and every comparison against NaN is
 * false. Both are the answer Godot gives, and both are why the callers must
 * reach a basis carrying `inf`/`nan` rather than treating it as unparseable.
 */
export function basisHasUnitScale(n: BasisComponents): boolean {
  return basisGetScale(n).every((axis) => isEqualApprox(axis, 1));
}

/**
 * `Basis::is_orthonormal()` (basis.cpp:103-107): every column of unit length
 * squared, every pair of columns perpendicular.
 *
 * `length_squared`, not `length`: the engine compares the square against 1, and
 * the two differ once a tolerance is involved.
 */
export function basisIsOrthonormal(n: BasisComponents): boolean {
  const x = column(n, 0);
  const y = column(n, 1);
  const z = column(n, 2);
  return (
    isEqualApprox(dot(x, x), 1) &&
    isEqualApprox(dot(y, y), 1) &&
    isEqualApprox(dot(z, z), 1) &&
    isZeroApprox(dot(x, y)) &&
    isZeroApprox(dot(x, z)) &&
    isZeroApprox(dot(y, z))
  );
}
