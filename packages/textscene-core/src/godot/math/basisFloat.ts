/**
 * Godot `Basis` methods in `real_t` float that only the lazily loaded particle simulations call.
 * esbuild puts a whole module in one chunk, so they live apart from `basis.ts`, which the
 * webview's initial chunk carries.
 */

import { storedReal as f } from './real.js';
import { UNIT_EPSILON } from './math.js';
import { basisCopy, IDENTITY_BASIS, type BasisComponents, type MutableBasis } from './basis.js';
import { vector3DotComponents, vector3LengthSquared, type Vector3 } from './vector.js';

/**
 * `Basis::xform` (`basis.h:336-341`) in `real_t` float: each row dotted with `v`. Not a
 * transform with a zero origin, which turns a -0 into +0.
 *
 * @canonical A vector through a Basis in float32
 */
export function basisXform(n: BasisComponents, v: Vector3): Vector3 {
  const { x, y, z } = v;
  return {
    x: vector3DotComponents(n[0], n[1], n[2], x, y, z),
    y: vector3DotComponents(n[3], n[4], n[5], x, y, z),
    z: vector3DotComponents(n[6], n[7], n[8], x, y, z),
  };
}

/**
 * `Basis::set_axis_angle` (`basis.cpp:840-868`) in `real_t` float, into `n`: the rotation by `angle`
 * radians about the unit `axis`, built from the axis-angle formula, not through a quaternion. A
 * non-normalised axis fails the editor build's `MATH_CHECKS` and leaves the identity.
 */
export function basisSetAxisAngle(n: MutableBasis, axis: Vector3, angle: number): MutableBasis {
  const { x, y, z } = axis;
  const lengthSquared = vector3LengthSquared(x, y, z);
  // `Vector3::is_normalized` (`vector3.h:566-569`): within `UNIT_EPSILON` of 1, squared.
  if (lengthSquared !== 1 && !(Math.abs(lengthSquared - 1) < UNIT_EPSILON)) {
    return basisCopy(n, IDENTITY_BASIS);
  }
  const cosine = f(Math.cos(angle));
  const sine = f(Math.sin(angle));
  const t = f(1 - cosine);
  // `xyzt ± zyxs`: the product of two axis components and `t`, then one component and `sine`.
  const xy = f(f(x * y) * t);
  const xz = f(f(x * z) * t);
  const yz = f(f(y * z) * t);
  const zs = f(z * sine);
  const ys = f(y * sine);
  const xs = f(x * sine);
  n[0] = axisAngleDiagonal(f(x * x), cosine);
  n[1] = f(xy - zs);
  n[2] = f(xz + ys);
  n[3] = f(xy + zs);
  n[4] = axisAngleDiagonal(f(y * y), cosine);
  n[5] = f(yz - xs);
  n[6] = f(xz - ys);
  n[7] = f(yz + xs);
  n[8] = axisAngleDiagonal(f(z * z), cosine);
  return n;
}

/** A diagonal element of `set_axis_angle`: `square + cosine * (1 - square)`. */
function axisAngleDiagonal(square: number, cosine: number): number {
  return f(square + f(cosine * f(1 - square)));
}

/** `Basis::scale` (`basis.cpp:234-238`) in `real_t` float, in place: each row times its axis. */
export function basisScale(n: MutableBasis, x: number, y: number, z: number): MutableBasis {
  for (let i = 0; i < 9; i++) n[i] = f(n[i]! * (i < 3 ? x : i < 6 ? y : z));
  return n;
}
