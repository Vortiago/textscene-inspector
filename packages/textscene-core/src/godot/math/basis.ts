/**
 * `Basis` (`core/math/basis.cpp`) over the nine components of a `Transform3D` literal. The writer
 * emits `m3.rows[i][j]` before the origin (`variant_parser.cpp:2114-2121`), so they are row-major
 * and column `i` is `(n[i], n[i + 3], n[i + 6])`. Here, not beside a rule: several unrelated
 * warnings (`Light3D`, `XROrigin3D`, `OpenXRCompositionLayer`, `RigidBody3D`) ask these questions.
 */

// Float arithmetic: each `f(...)` rounds as a C++ `float` operation does.
import { storedReal as f } from './real.js';
import { basisDeterminant, isEqualApprox, isZeroApprox, sign } from './math.js';
import type { Quaternion } from './quaternion.js';
import { normalizedVector3, vector3Dot, type Vector3 } from './vector.js';

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

export type Triple = [number, number, number];

/** Column `index` of the basis, the vector `Basis::get_column` returns. */
export function basisColumn(n: BasisComponents, index: number): Triple {
  return [n[index]!, n[index + 3]!, n[index + 6]!];
}

function scaled(v: Triple, s: number): Triple {
  return [f(v[0] * s), f(v[1] * s), f(v[2] * s)];
}

function subtract(a: Triple, b: Triple): Triple {
  return [f(a[0] - b[0]), f(a[1] - b[1]), f(a[2] - b[2])];
}

/**
 * `Basis::orthonormalize` (`basis.cpp:56-72`): Gram-Schmidt over the columns, which drops the scale and
 * the shear.
 * @canonical A basis made orthonormal, column by column
 */
export function basisOrthonormalized(n: BasisComponents): BasisComponents {
  const x = normalizedVector3(...basisColumn(n, 0));
  const yColumn = basisColumn(n, 1);
  const y = normalizedVector3(...subtract(yColumn, scaled(x, vector3Dot(x, yColumn))));
  const zColumn = basisColumn(n, 2);
  const z = normalizedVector3(
    ...subtract(subtract(zColumn, scaled(x, vector3Dot(x, zColumn))), scaled(y, vector3Dot(y, zColumn)))
  );
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

/** The determinant of `n`, with the nine components `basisDeterminant` takes. */
function determinantOf(n: BasisComponents): number {
  return basisDeterminant(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], n[8]);
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
  const detSign = sign(determinantOf(n));
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
  const x = basisColumn(n, 0);
  const y = basisColumn(n, 1);
  const z = basisColumn(n, 2);
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
 * early, so a singular basis stays as it is.
 */
export function basisInvert(n: BasisComponents): BasisComponents {
  const at = (row: number, col: number): number => n[row * 3 + col]!;
  // `cofac(row1, col1, row2, col2)` (`basis.cpp:35-36`).
  const cofac = (row1: number, col1: number, row2: number, col2: number): number =>
    f(f(at(row1, col1) * at(row2, col2)) - f(at(row1, col2) * at(row2, col1)));
  const co = [cofac(1, 1, 2, 2), cofac(1, 2, 2, 0), cofac(1, 0, 2, 1)] as const;
  const determinant = f(f(f(at(0, 0) * co[0]) + f(at(0, 1) * co[1])) + f(at(0, 2) * co[2]));
  if (determinant === 0) return n;
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

/**
 * `Basis::operator*` (`basis.h:281-286`): each component is `tdot` of the right over the left's row.
 *
 * @canonical A Basis product and a Basis from a quaternion and a scale
 *   `basisMultiply`, `basisFromQuaternion` and `basisFromQuaternionScale`, in float32 as Godot rounds.
 */
export function basisMultiply(left: BasisComponents, right: BasisComponents): BasisComponents {
  return basisFrom((i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    return f(
      f(f(right[col]! * left[3 * row]!) + f(right[3 + col]! * left[3 * row + 1]!)) +
        f(right[6 + col]! * left[3 * row + 2]!)
    );
  });
}

/** The basis whose row-major component `i` is `component(i)`. */
export function basisFrom(component: (i: number) => number): BasisComponents {
  return [
    component(0),
    component(1),
    component(2),
    component(3),
    component(4),
    component(5),
    component(6),
    component(7),
    component(8),
  ];
}

/** The scale basis of `x`, `y` and `z`, each held in float32. */
export function basisDiagonal(x: number, y: number, z: number): BasisComponents {
  return [f(x), 0, 0, 0, f(y), 0, 0, 0, f(z)];
}

/** `Basis::set_quaternion` (`basis.cpp:828-838`). It divides by the squared length, so any length turns. */
export function basisFromQuaternion({ x: qx, y: qy, z: qz, w: qw }: Quaternion): BasisComponents {
  const [x, y, z, w] = [qx, qy, qz, qw].map(f) as [number, number, number, number];
  const d = f(f(f(f(x * x) + f(y * y)) + f(z * z)) + f(w * w));
  const s = f(2 / d);
  const xs = f(x * s);
  const ys = f(y * s);
  const zs = f(z * s);
  const [wx, wy, wz] = [f(w * xs), f(w * ys), f(w * zs)];
  const [xx, xy, xz] = [f(x * xs), f(x * ys), f(x * zs)];
  const [yy, yz, zz] = [f(y * ys), f(y * zs), f(z * zs)];
  return [
    f(1 - f(yy + zz)),
    f(xy - wz),
    f(xz + wy),
    f(xy + wz),
    f(1 - f(xx + zz)),
    f(yz - wx),
    f(xz - wy),
    f(yz + wx),
    f(1 - f(xx + yy)),
  ];
}

/**
 * `Basis::set_quaternion_scale` (`basis.cpp:880-883`): the diagonal of `scale`, rotated by the
 * quaternion, so each column of the rotation takes its axis's scale.
 */
export function basisFromQuaternionScale(rotation: Quaternion, scale: Vector3): BasisComponents {
  return basisMultiply(basisFromQuaternion(rotation), basisDiagonal(scale.x, scale.y, scale.z));
}

/**
 * `Basis::get_quaternion` (`basis.cpp:714-748`): the quaternion of a basis that is a rotation, by
 * the largest of the trace and the diagonal.
 */
function basisGetQuaternion(n: BasisComponents): Quaternion {
  const at = (row: number, col: number): number => n[row * 3 + col]!;
  const trace = f(f(at(0, 0) + at(1, 1)) + at(2, 2));
  if (trace > 0) {
    const root = f(Math.sqrt(f(trace + 1)));
    const scale = f(0.5 / root);
    return {
      x: f(f(at(2, 1) - at(1, 2)) * scale),
      y: f(f(at(0, 2) - at(2, 0)) * scale),
      z: f(f(at(1, 0) - at(0, 1)) * scale),
      w: f(root * 0.5),
    };
  }
  const i = at(0, 0) < at(1, 1) ? (at(1, 1) < at(2, 2) ? 2 : 1) : at(0, 0) < at(2, 2) ? 2 : 0;
  const j = (i + 1) % 3;
  const k = (i + 2) % 3;
  const root = f(Math.sqrt(f(f(f(at(i, i) - at(j, j)) - at(k, k)) + 1)));
  const scale = f(0.5 / root);
  const result = [0, 0, 0, 0];
  result[i] = f(root * 0.5);
  result[3] = f(f(at(k, j) - at(j, k)) * scale);
  result[j] = f(f(at(j, i) + at(i, j)) * scale);
  result[k] = f(f(at(k, i) + at(i, k)) * scale);
  return { x: result[0]!, y: result[1]!, z: result[2]!, w: result[3]! };
}

/**
 * `Basis::get_rotation_quaternion` (`basis.cpp:399-411`): the rotation of a basis that also scales.
 * The basis is made orthonormal, and a mirrored one is negated into a proper rotation.
 *
 * @canonical The rotation quaternion of a basis
 */
export function basisGetRotationQuaternion(n: BasisComponents): Quaternion {
  const orthonormal = basisOrthonormalized(n);
  const [a, b, c, d, e, g, h, i, j] = orthonormal;
  return basisGetQuaternion(
    determinantOf(orthonormal) < 0 ? [-a, -b, -c, -d, -e, -g, -h, -i, -j] : orthonormal
  );
}
