/**
 * `Basis` (`core/math/basis.cpp`) over the nine components of a `Transform3D` literal. The writer
 * emits `m3.rows[i][j]` before the origin (`variant_parser.cpp:2114-2121`), so they are row-major
 * and column `i` is `(n[i], n[i + 3], n[i + 6])`. Here, not beside a rule: several unrelated
 * warnings (`Light3D`, `XROrigin3D`, `OpenXRCompositionLayer`, `RigidBody3D`) ask these questions.
 */

import { basisDeterminant, isEqualApprox, isZeroApprox, sign } from './math.js';
import { vector3Dot } from './vector.js';

/** Float arithmetic: each `f(...)` rounds as a C++ `float` operation does. */
const f = Math.fround;

/** The nine row-major components of a serialised `Basis`. */
export type BasisComponents = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** Column `index` of the basis, the vector `Basis::get_column` returns. */
function column(n: BasisComponents, index: number): [number, number, number] {
  return [n[index]!, n[index + 3]!, n[index + 6]!];
}

/** `Basis::get_scale_abs()` (basis.cpp:287-292): the three column magnitudes, unsigned. */
export function basisGetScaleAbs(n: BasisComponents): [number, number, number] {
  return [Math.hypot(n[0], n[3], n[6]), Math.hypot(n[1], n[4], n[7]), Math.hypot(n[2], n[5], n[8])];
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
    isEqualApprox(vector3Dot(x, x), 1) &&
    isEqualApprox(vector3Dot(y, y), 1) &&
    isEqualApprox(vector3Dot(z, z), 1) &&
    isZeroApprox(vector3Dot(x, y)) &&
    isZeroApprox(vector3Dot(x, z)) &&
    isZeroApprox(vector3Dot(y, z))
  );
}

/**
 * `Basis::invert` (`core/math/basis.cpp:38-54`) in `real_t` float, each step rounded in Godot's
 * order. The editor build checks the determinant (`MATH_CHECKS`, `math_defs.h:55-57`) and returns
 * early, so a singular basis stays as it is. `n` holds the nine row-major components.
 */
export function basisInvert(n: readonly number[]): BasisComponents {
  const at = (row: number, col: number): number => n[row * 3 + col]!;
  // `cofac(row1, col1, row2, col2)` (`basis.cpp:35-36`).
  const cofac = (row1: number, col1: number, row2: number, col2: number): number =>
    f(f(at(row1, col1) * at(row2, col2)) - f(at(row1, col2) * at(row2, col1)));
  const co = [cofac(1, 1, 2, 2), cofac(1, 2, 2, 0), cofac(1, 0, 2, 1)] as const;
  const determinant = f(f(f(at(0, 0) * co[0]) + f(at(0, 1) * co[1])) + f(at(0, 2) * co[2]));
  if (determinant === 0) {
    return [at(0, 0), at(0, 1), at(0, 2), at(1, 0), at(1, 1), at(1, 2), at(2, 0), at(2, 1), at(2, 2)];
  }
  const s = f(1 / determinant);
  return [
    f(co[0] * s),
    f(cofac(0, 2, 2, 1) * s),
    f(cofac(0, 1, 1, 2) * s),
    f(co[1] * s),
    f(cofac(0, 0, 2, 2) * s),
    f(cofac(0, 2, 1, 0) * s),
    f(co[2] * s),
    f(cofac(0, 1, 2, 0) * s),
    f(cofac(0, 0, 1, 1) * s),
  ];
}
