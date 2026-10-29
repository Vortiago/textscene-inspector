/**
 * Godot `Basis` methods in `real_t` float that only the lazily loaded particle simulations call.
 * esbuild puts a whole module in one chunk, so they live apart from `basis.ts`, which the
 * webview's initial chunk carries.
 */

import { storedReal as f } from './real.js';
import { UNIT_EPSILON } from './math.js';
import { basisFrom, type BasisComponents, type Triple } from './basis.js';
import { vector3Dot, type Vector3 } from './vector.js';

/**
 * `Basis::xform` (`basis.h:336-341`) in `real_t` float: each row dotted with `v`. Not a
 * transform with a zero origin, which turns a -0 into +0.
 *
 * @canonical A vector through a Basis in float32
 */
export function basisXform(n: BasisComponents, v: Vector3): Vector3 {
  const components: Triple = [v.x, v.y, v.z];
  return {
    x: vector3Dot([n[0], n[1], n[2]], components),
    y: vector3Dot([n[3], n[4], n[5]], components),
    z: vector3Dot([n[6], n[7], n[8]], components),
  };
}

/**
 * `Basis::set_axis_angle` (`basis.cpp:840-868`) in `real_t` float: the rotation by `angle` radians
 * about the unit `axis`, built from the axis-angle formula, not through a quaternion. A
 * non-normalised axis fails the editor build's `MATH_CHECKS` and leaves the identity.
 */
export function basisFromAxisAngle(axis: Vector3, angle: number): BasisComponents {
  const lengthSquared = vector3Dot([axis.x, axis.y, axis.z], [axis.x, axis.y, axis.z]);
  // `Vector3::is_normalized` (`vector3.h:566-569`): within `UNIT_EPSILON` of 1, squared.
  if (lengthSquared !== 1 && !(Math.abs(lengthSquared - 1) < UNIT_EPSILON))
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const sq = { x: f(axis.x * axis.x), y: f(axis.y * axis.y), z: f(axis.z * axis.z) };
  const cosine = f(Math.cos(angle));
  const sine = f(Math.sin(angle));
  const t = f(1 - cosine);
  const diagonal = (square: number) => f(square + f(cosine * f(1 - square)));
  // `xyzt ± zyxs`: the product of two axis components and `t`, then one component and `sine`.
  const pair = (a: number, b: number) => f(f(a * b) * t);
  const xy = pair(axis.x, axis.y);
  const xz = pair(axis.x, axis.z);
  const yz = pair(axis.y, axis.z);
  const zs = f(axis.z * sine);
  const ys = f(axis.y * sine);
  const xs = f(axis.x * sine);
  return [
    diagonal(sq.x),
    f(xy - zs),
    f(xz + ys),
    f(xy + zs),
    diagonal(sq.y),
    f(yz - xs),
    f(xz - ys),
    f(yz + xs),
    diagonal(sq.z),
  ];
}

/** `Basis::scale` (`basis.cpp:234-238`) in `real_t` float: each row times its axis of `scale`. */
export function basisScaledRows(n: BasisComponents, scale: Vector3): BasisComponents {
  const factor = [scale.x, scale.y, scale.z] as const;
  return basisFrom((i) => f(n[i]! * factor[Math.floor(i / 3)]!));
}
