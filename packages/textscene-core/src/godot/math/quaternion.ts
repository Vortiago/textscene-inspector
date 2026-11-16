/** Godot's `Quaternion` (`core/math/quaternion.h`) as plain components, and the operations a pose edit reads. */

// Float arithmetic: each `f(...)` rounds as a C++ `float` operation does.
import { CMP_EPSILON, isUnitWithinEpsilon } from './math.js';
import { storedReal as f } from './real.js';
import { acosf, cosf, sinf } from './realMath.js';
import type { Vector3 } from './vector.js';

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** The turn of no rotation. Callers treat a quaternion as immutable, so one value is shared. */
export const QUATERNION_IDENTITY: Quaternion = { x: 0, y: 0, z: 0, w: 1 };

/**
 * `Quaternion(axis, angle)` (`quaternion.cpp:283-302`): the vector part is the axis times
 * `sin(angle / 2)`, and a zero axis gives the all-zero quaternion.
 */
export function quaternionFromAxisAngle(axis: Vector3, angle: number): Quaternion {
  const length = f(Math.sqrt(f(f(f(axis.x * axis.x) + f(axis.y * axis.y)) + f(axis.z * axis.z))));
  if (length === 0) return { x: 0, y: 0, z: 0, w: 0 };
  const halfAngle = f(angle * 0.5);
  const s = f(sinf(halfAngle) / length);
  return { x: f(axis.x * s), y: f(axis.y * s), z: f(axis.z * s), w: cosf(halfAngle) };
}

/**
 * `Quaternion::operator*` (`quaternion.h:196-203`): `left * right` turns by `right` first.
 *
 * @canonical A Quaternion product, inverse, normal form, slerp and axis-angle, in float32
 *   `quaternionMultiply`, `quaternionInverse`, `normalizedQuaternion`, `quaternionSlerp` and
 *   `quaternionFromAxisAngle`.
 */
export function quaternionMultiply(left: Quaternion, right: Quaternion): Quaternion {
  const { x: lx, y: ly, z: lz, w: lw } = left;
  const { x: rx, y: ry, z: rz, w: rw } = right;
  // `operator*=` (quaternion.h:237) sums each component left to right.
  return {
    x: f(f(f(f(lw * rx) + f(lx * rw)) + f(ly * rz)) - f(lz * ry)),
    y: f(f(f(f(lw * ry) + f(ly * rw)) + f(lz * rx)) - f(lx * rz)),
    z: f(f(f(f(lw * rz) + f(lz * rw)) + f(lx * ry)) - f(ly * rx)),
    w: f(f(f(f(lw * rw) - f(lx * rx)) - f(ly * ry)) - f(lz * rz)),
  };
}

/** `Quaternion::inverse` (`quaternion.h:74-80`): the conjugate, which inverts a unit quaternion. */
export function quaternionInverse({ x, y, z, w }: Quaternion): Quaternion {
  return { x: f(-x), y: f(-y), z: f(-z), w };
}

/** `Quaternion::normalized` (quaternion.cpp:69): each component times `1 / length`, as `operator/` does. */
export function normalizedQuaternion(q: Quaternion): Quaternion {
  const { x, y, z, w } = q;
  const inverseLength = f(1 / f(Math.sqrt(quaternionDot(q, q))));
  return {
    x: f(x * inverseLength),
    y: f(y * inverseLength),
    z: f(z * inverseLength),
    w: f(w * inverseLength),
  };
}

/** `Quaternion::is_normalized` (quaternion.cpp:73): the squared length within float `UNIT_EPSILON` of 1. */
export function quaternionIsNormalized(q: Quaternion): boolean {
  const lengthSquared = quaternionDot(q, q);
  return isUnitWithinEpsilon(lengthSquared);
}

/** `Quaternion::slerp` (quaternion.cpp:101): MATH_CHECKS, on in the editor, gives `Quaternion()` off unit. */
export function quaternionSlerp(from: Quaternion, to: Quaternion, weight: number): Quaternion {
  if (!quaternionIsNormalized(from) || !quaternionIsNormalized(to)) return QUATERNION_IDENTITY;
  let cosine = quaternionDot(from, to);
  const sign = cosine < 0 ? -1 : 1;
  cosine = Math.abs(cosine);
  let fromScale = f(1 - weight);
  let toScale = weight;
  if (f(1 - cosine) > CMP_EPSILON) {
    const omega = acosf(cosine);
    const sine = sinf(omega);
    // `(1.0 - p_weight) * omega` is a double, and `p_weight * omega` a float that `sinf` takes.
    fromScale = f(Math.sin((1 - weight) * omega) / sine);
    toScale = f(sinf(f(weight * omega)) / sine);
  }
  return {
    x: f(f(fromScale * from.x) + f(toScale * sign * to.x)),
    y: f(f(fromScale * from.y) + f(toScale * sign * to.y)),
    z: f(f(fromScale * from.z) + f(toScale * sign * to.z)),
    w: f(f(fromScale * from.w) + f(toScale * sign * to.w)),
  };
}

/** `Quaternion::dot` (`quaternion.h`). */
export function quaternionDot(a: Quaternion, b: Quaternion): number {
  return f(f(f(f(a.x * b.x) + f(a.y * b.y)) + f(a.z * b.z)) + f(a.w * b.w));
}
