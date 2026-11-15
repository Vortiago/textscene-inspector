/**
 * The C++ constructors of Godot's rotation types in `real_t` float: Transform2D from an angle
 * (transform_2d.cpp:97), Quaternion from an axis and angle, an arc or a Basis (quaternion.cpp,
 * quaternion.h:138, basis.cpp get_quaternion), and Plane from points (plane.h:120).
 */

import type { BasisComponents } from '../../math/basis.js';
import type { Plane } from '../../math/plane.js';
import type { Quaternion } from '../../math/quaternion.js';
import { storedReal as f } from '../../math/real.js';
import type { Transform2DColumns } from '../../math/transform2d.js';
import type { Vector2, Vector3 } from '../../math/vector.js';

type V3 = Readonly<Vector3>;

const CMP_EPSILON = f(0.00001);
const UNIT_EPSILON = f(0.001);
const IDENTITY: Quaternion = { x: 0, y: 0, z: 0, w: 1 };

// Math::sin and Math::cos of a float call sinf and cosf, which round the true value once.
const sinf = (x: number) => f(Math.sin(x));
const cosf = (x: number) => f(Math.cos(x));

const dot3 = (a: V3, b: V3) => f(f(f(a.x * b.x) + f(a.y * b.y)) + f(a.z * b.z));
const sub3 = (a: V3, b: V3): Vector3 => ({ x: f(a.x - b.x), y: f(a.y - b.y), z: f(a.z - b.z) });
const cross3 = (a: V3, b: V3): Vector3 => ({
  x: f(f(a.y * b.z) - f(a.z * b.y)),
  y: f(f(a.z * b.x) - f(a.x * b.z)),
  z: f(f(a.x * b.y) - f(a.y * b.x)),
});

function normalized3(v: V3): Vector3 {
  const lengthSquared = dot3(v, v);
  if (lengthSquared === 0) return { x: 0, y: 0, z: 0 };
  const length = f(Math.sqrt(lengthSquared));
  return { x: f(v.x / length), y: f(v.y / length), z: f(v.z / length) };
}

// Math::is_equal_approx(float, float, tolerance) and its two-argument form (math_funcs.h:520-551).
const isEqualWithin = (a: number, b: number, tolerance: number) => a === b || Math.abs(f(a - b)) < tolerance;
function isEqualApprox(a: number, b: number): boolean {
  if (a === b) return true;
  const tolerance = Math.max(f(CMP_EPSILON * Math.abs(a)), CMP_EPSILON);
  return Math.abs(f(a - b)) < tolerance;
}
const isZeroApprox = (value: number) => Math.abs(value) < CMP_EPSILON;

export const isNormalized3 = (v: V3) => isEqualWithin(dot3(v, v), 1, UNIT_EPSILON);

export function transform2DFromRotation(rotation: number, position: Readonly<Vector2>): Transform2DColumns {
  const cr = cosf(rotation);
  const sr = sinf(rotation);
  return { a: cr, b: sr, c: -sr, d: cr, tx: position.x, ty: position.y };
}

export function transform2DFromParts(
  rotation: number,
  scale: Readonly<Vector2>,
  skew: number,
  position: Readonly<Vector2>
): Transform2DColumns {
  const skewed = f(rotation + skew);
  return {
    a: f(cosf(rotation) * scale.x),
    b: f(sinf(rotation) * scale.x),
    c: f(-sinf(skewed) * scale.y),
    d: f(cosf(skewed) * scale.y),
    tx: position.x,
    ty: position.y,
  };
}

// MATH_CHECKS refuses an axis that is not normalised and leaves Quaternion().
export function quaternionFromAxisAngle(axis: V3, angle: number): Quaternion {
  if (!isNormalized3(axis)) return IDENTITY;
  const d = f(Math.sqrt(dot3(axis, axis)));
  if (d === 0) return { x: 0, y: 0, z: 0, w: 0 };
  const half = f(angle * 0.5);
  const s = f(sinf(half) / d);
  return { x: f(axis.x * s), y: f(axis.y * s), z: f(axis.z * s), w: cosf(half) };
}

const ALMOST_ONE = f(0.99999975);
const isZeroApprox3 = (v: V3) => isZeroApprox(v.x) && isZeroApprox(v.y) && isZeroApprox(v.z);

// Vector3::get_any_perpendicular (vector3.h:375): the cross with RIGHT or UP, whichever is less parallel.
function anyPerpendicular(v: V3): Vector3 {
  if (isZeroApprox3(v)) return { x: 0, y: 0, z: 0 };
  const isRight = Math.abs(v.x) <= Math.abs(v.y) && Math.abs(v.x) <= Math.abs(v.z);
  return normalized3(cross3(v, isRight ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }));
}

/** The shortest arc from `from` to `to`. MATH_CHECKS refuses a zero vector and leaves Quaternion(). */
export function quaternionArc(from: V3, to: V3): Quaternion {
  if (isZeroApprox3(from) || isZeroApprox3(to)) return IDENTITY;
  const n0 = normalized3(from);
  const n1 = normalized3(to);
  const d = dot3(n0, n1);
  if (Math.abs(d) > ALMOST_ONE) {
    if (d >= 0) return IDENTITY;
    return { ...anyPerpendicular(n0), w: 0 };
  }
  const c = cross3(n0, n1);
  const s = f(Math.sqrt(f(f(1 + d) * 2)));
  const rs = f(1 / s);
  return { x: f(c.x * rs), y: f(c.y * rs), z: f(c.z * rs), w: f(s * 0.5) };
}

const at = (n: BasisComponents, row: number, column: number) => n[row * 3 + column]!;
const column = (n: BasisComponents, index: number): Vector3 => ({
  x: n[index]!,
  y: n[index + 3]!,
  z: n[index + 6]!,
});

function determinant(n: BasisComponents): number {
  const minor = (r1: number, c1: number, r2: number, c2: number) =>
    f(f(at(n, r1, c1) * at(n, r2, c2)) - f(at(n, r2, c1) * at(n, r1, c2)));
  return f(
    f(f(at(n, 0, 0) * minor(1, 1, 2, 2)) - f(at(n, 1, 0) * minor(0, 1, 2, 2))) +
      f(at(n, 2, 0) * minor(0, 1, 1, 2))
  );
}

// Basis::is_conformal and is_rotation (basis.cpp).
function isRotation(n: BasisComponents): boolean {
  const [x, y, z] = [column(n, 0), column(n, 1), column(n, 2)];
  const xLengthSquared = dot3(x, x);
  const isConformal =
    isEqualApprox(xLengthSquared, dot3(y, y)) &&
    isEqualApprox(xLengthSquared, dot3(z, z)) &&
    isZeroApprox(dot3(x, y)) &&
    isZeroApprox(dot3(x, z)) &&
    isZeroApprox(dot3(y, z));
  return isConformal && isEqualWithin(determinant(n), 1, UNIT_EPSILON);
}

/** `Basis::get_quaternion`: MATH_CHECKS refuses a basis that is not a rotation and gives Quaternion(). */
export function basisQuaternion(n: BasisComponents): Quaternion {
  if (!isRotation(n)) return IDENTITY;
  const trace = f(f(at(n, 0, 0) + at(n, 1, 1)) + at(n, 2, 2));
  const temp = [0, 0, 0, 0];
  if (trace > 0) {
    let s = f(Math.sqrt(f(trace + 1)));
    temp[3] = f(s * 0.5);
    s = f(0.5 / s);
    temp[0] = f(f(at(n, 2, 1) - at(n, 1, 2)) * s);
    temp[1] = f(f(at(n, 0, 2) - at(n, 2, 0)) * s);
    temp[2] = f(f(at(n, 1, 0) - at(n, 0, 1)) * s);
  } else {
    const i =
      at(n, 0, 0) < at(n, 1, 1) ? (at(n, 1, 1) < at(n, 2, 2) ? 2 : 1) : at(n, 0, 0) < at(n, 2, 2) ? 2 : 0;
    const j = (i + 1) % 3;
    const k = (i + 2) % 3;
    let s = f(Math.sqrt(f(f(f(at(n, i, i) - at(n, j, j)) - at(n, k, k)) + 1)));
    temp[i] = f(s * 0.5);
    s = f(0.5 / s);
    temp[3] = f(f(at(n, k, j) - at(n, j, k)) * s);
    temp[j] = f(f(at(n, j, i) + at(n, i, j)) * s);
    temp[k] = f(f(at(n, k, i) + at(n, i, k)) * s);
  }
  return { x: temp[0]!, y: temp[1]!, z: temp[2]!, w: temp[3]! };
}

export function planeFromNormalPoint(normal: V3, point: V3): Plane {
  return { normal, d: dot3(normal, point) };
}

export function planeFromPoints(a: V3, b: V3, c: V3): Plane {
  const normal = normalized3(cross3(sub3(a, c), sub3(a, b)));
  return { normal, d: dot3(normal, a) };
}
