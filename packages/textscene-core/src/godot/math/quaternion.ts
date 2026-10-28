/** Godot's `Quaternion` (`core/math/quaternion.h`) as plain components, and the operations a pose edit reads. */

// Float arithmetic: each `f(...)` rounds as a C++ `float` operation does.
import { CMP_EPSILON } from './math.js';
import type { Vector3 } from './vector.js';
import { storedReal as f } from './real.js';

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * `Quaternion(axis, angle)` (`quaternion.cpp:283-302`): the vector part is the axis times
 * `sin(angle / 2)`, and a zero axis gives the all-zero quaternion.
 */
export function quaternionFromAxisAngle(axis: Vector3, angle: number): Quaternion {
  const length = f(Math.sqrt(f(f(f(axis.x * axis.x) + f(axis.y * axis.y)) + f(axis.z * axis.z))));
  if (length === 0) return { x: 0, y: 0, z: 0, w: 0 };
  const halfAngle = f(angle * 0.5);
  const s = f(f(Math.sin(halfAngle)) / length);
  return { x: f(axis.x * s), y: f(axis.y * s), z: f(axis.z * s), w: f(Math.cos(halfAngle)) };
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
  return {
    x: f(f(f(lw * rx) + f(lx * rw)) + f(f(ly * rz) - f(lz * ry))),
    y: f(f(f(lw * ry) + f(ly * rw)) + f(f(lz * rx) - f(lx * rz))),
    z: f(f(f(lw * rz) + f(lz * rw)) + f(f(lx * ry) - f(ly * rx))),
    w: f(f(f(lw * rw) - f(lx * rx)) - f(f(ly * ry) + f(lz * rz))),
  };
}

/** `Quaternion::inverse` (`quaternion.h:74-80`): the conjugate, which inverts a unit quaternion. */
export function quaternionInverse({ x, y, z, w }: Quaternion): Quaternion {
  return { x: f(-x), y: f(-y), z: f(-z), w };
}

/** `Quaternion::normalized` (`quaternion.h:88-90`): the four components over the length. */
export function normalizedQuaternion({ x, y, z, w }: Quaternion): Quaternion {
  const length = f(Math.sqrt(f(f(f(x * x) + f(y * y)) + f(f(z * z) + f(w * w)))));
  return { x: f(x / length), y: f(y / length), z: f(z / length), w: f(w / length) };
}

/**
 * `Quaternion::slerp` (`quaternion.cpp:101-140`): along the shorter arc, by `weight`. Two
 * quaternions within `CMP_EPSILON` of coinciding interpolate linearly.
 */
export function quaternionSlerp(from: Quaternion, to: Quaternion, weight: number): Quaternion {
  let cosine = quaternionDot(from, to);
  const sign = cosine < 0 ? -1 : 1;
  cosine = Math.abs(cosine);
  let fromScale = f(1 - weight);
  let toScale = weight;
  if (f(1 - cosine) > CMP_EPSILON) {
    const omega = f(Math.acos(cosine));
    const sine = f(Math.sin(omega));
    fromScale = f(Math.sin((1 - weight) * omega) / sine);
    toScale = f(Math.sin(weight * omega) / sine);
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
  return f(f(f(a.x * b.x) + f(a.y * b.y)) + f(f(a.z * b.z) + f(a.w * b.w)));
}
