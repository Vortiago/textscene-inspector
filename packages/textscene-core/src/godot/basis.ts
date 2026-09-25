/**
 * `Basis` (`core/math/basis.cpp`) over the nine components of a `Transform3D` literal. The writer
 * emits `m3.rows[i][j]` before the origin (`variant_parser.cpp:2114-2121`), so they are row-major
 * and column `i` is `(n[i], n[i + 3], n[i + 6])`. Here, not beside a rule: several unrelated
 * warnings (`Light3D`, `XROrigin3D`, `OpenXRCompositionLayer`, `RigidBody3D`) ask these questions.
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

/** `Basis::get_scale_abs()` (basis.cpp:287-292): the three column magnitudes, unsigned. */
export function basisGetScaleAbs(n: BasisComponents): [number, number, number] {
  return [
    Math.hypot(n[0], n[3], n[6]),
    Math.hypot(n[1], n[4], n[7]),
    Math.hypot(n[2], n[5], n[8]),
  ];
}

/**
 * `Basis::get_scale()` (basis.cpp:321-322): `SIGN(determinant()) * get_scale_abs()`, which every
 * unit-scale configuration warning reads. `SIGN` is three-valued (typedefs.h:123-126), so a
 * mirrored basis scales to (-1, -1, -1) and a degenerate one to (0, 0, 0). A NaN determinant also
 * signs as 0, which leaves the NaN axis NaN and the others exact 0.
 */
export function basisGetScale(n: BasisComponents): [number, number, number] {
  const detSign = sign(basisDeterminant(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], n[8]));
  const abs = basisGetScaleAbs(n);
  return [detSign * abs[0], detSign * abs[1], detSign * abs[2]];
}

/**
 * Whether `get_scale()` is `(1, 1, 1)` by `Vector3::is_equal_approx` (vector3.cpp:141-143), in the
 * engine's operand order: the tolerance is relative to the left operand. An `inf` or NaN axis is
 * not unit, as in Godot, so callers read a basis carrying `inf`/`nan` rather than refuse it.
 */
export function basisHasUnitScale(n: BasisComponents): boolean {
  return basisGetScale(n).every((axis) => isEqualApprox(axis, 1));
}

/**
 * `Basis::is_orthonormal()` (basis.cpp:103-107): every column of unit length squared, every pair
 * perpendicular. The square, not the length: the two differ once a tolerance is involved.
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
