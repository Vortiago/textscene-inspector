/** Godot's spherical cubic interpolation of a `Quaternion` (`core/math/quaternion.cpp`), the rotation of a cubic animation track. */

// Float arithmetic: each `f(...)` rounds as a C++ `float` operation does.
import { basisFromQuaternion, basisGetRotationQuaternion } from './basis.js';
import { CMP_EPSILON, UNIT_EPSILON, type KeyTimes } from './math.js';
import {
  quaternionDot,
  quaternionFromAxisAngle,
  quaternionInverse,
  quaternionMultiply,
  quaternionSlerp,
  type Quaternion,
} from './quaternion.js';
import { storedReal as f } from './real.js';
import {
  normalizedVector3,
  vector3CubicInterpolateInTime,
  vector3Dot,
  vector3Length,
  type Vector3,
} from './vector.js';

function negatedQuaternion({ x, y, z, w }: Quaternion): Quaternion {
  return { x: -x, y: -y, z: -z, w: -w };
}

/** `Math::acos` (`math_funcs.h:110-112`): a cosine past one, which float rounding produces, gives 0, and one below -1 gives π. */
function acosClamped(cosine: number): number {
  return cosine < -1 ? f(Math.PI) : cosine > 1 ? 0 : Math.acos(cosine);
}

/**
 * `Quaternion::log` (`quaternion.cpp:84-88`): the axis times the angle, as the vector part. The
 * axis of a quaternion with `|w|` above `1 - CMP_EPSILON` is its own vector part, as `get_axis` reads it.
 */
function quaternionLog({ x, y, z, w }: Quaternion): Vector3 {
  const angle = f(2 * f(acosClamped(w)));
  const scale = Math.abs(w) > 1 - CMP_EPSILON ? 1 : f(1 / f(Math.sqrt(f(1 - f(w * w)))));
  return { x: f(f(x * scale) * angle), y: f(f(y * scale) * angle), z: f(f(z * scale) * angle) };
}

/** `Quaternion::exp` (`quaternion.cpp:90-99`): the turn about the vector part by its length, or no turn. */
function quaternionExp({ x, y, z }: Vector3): Quaternion {
  const theta = vector3Length(x, y, z);
  const axis = normalizedVector3(x, y, z);
  const isUnitAxis = Math.abs(vector3Dot(axis, axis) - 1) < UNIT_EPSILON;
  if (theta < CMP_EPSILON || !isUnitAxis) return { x: 0, y: 0, z: 0, w: 1 };
  return quaternionFromAxisAngle({ x: axis[0], y: axis[1], z: axis[2] }, theta);
}

/** The expmap of `target`, `pre` and `post` seen from `base`, as each cubic of `spherical_cubic_interpolate_in_time` sees them. */
function turnsSeenFrom(base: Quaternion, quaternions: readonly Quaternion[]): Vector3[] {
  const baseInverse = quaternionInverse(base);
  return quaternions.map((quaternion) => quaternionLog(quaternionMultiply(baseInverse, quaternion)));
}

/** One cubic through the turns of `from`, `to`, `pre` and `post` taken in the space of `base`, applied on `base`. */
function cubicTurnFrom(
  base: Quaternion,
  turns: { from: Vector3; to: Vector3; pre: Vector3; post: Vector3 },
  weight: number,
  times: KeyTimes
): Quaternion {
  const { from, to, pre, post } = turns;
  return quaternionMultiply(
    base,
    quaternionExp(vector3CubicInterpolateInTime(from, to, pre, post, weight, times))
  );
}

/** `Basis(quaternion).get_rotation_quaternion()`: the quaternion with its flip phase aligned. */
function rotationOf(quaternion: Quaternion): Quaternion {
  return basisGetRotationQuaternion(basisFromQuaternion(quaternion));
}

const NO_TURN: Vector3 = { x: 0, y: 0, z: 0 };

/** `std::signbit`: true for a negative number and for negative zero. */
function hasSignBit(value: number): boolean {
  return value < 0 || Object.is(value, -0);
}

/**
 * `Quaternion::spherical_cubic_interpolate_in_time` (`quaternion.cpp:216-264`): a cubic through the
 * logarithms of the keys taken in the space of `from`, another taken in the space of `to`, and the
 * two results slerped by `weight` to cancel the error of the expmap. A key joins along the shorter
 * arc. `times` are those of `to`, `pre` and `post`, counted from `from`.
 *
 * @canonical A Quaternion on a spherical cubic through keys at uneven times
 */
export function quaternionSphericalCubicInterpolateInTime(
  from: Quaternion,
  to: Quaternion,
  pre: Quaternion,
  post: Quaternion,
  weight: number,
  times: KeyTimes
): Quaternion {
  const fromQ = rotationOf(from);
  const rawPre = rotationOf(pre);
  const rawTo = rotationOf(to);
  const rawPost = rotationOf(post);

  const preQ = hasSignBit(quaternionDot(fromQ, rawPre)) ? negatedQuaternion(rawPre) : rawPre;
  const toFlipped = hasSignBit(quaternionDot(fromQ, rawTo));
  const toQ = toFlipped ? negatedQuaternion(rawTo) : rawTo;
  // After a flip of `to`, the key past it flips on `<= 0` (`quaternion.cpp:238`).
  const postDot = quaternionDot(toQ, rawPost);
  const postQ = (toFlipped ? postDot <= 0 : hasSignBit(postDot)) ? negatedQuaternion(rawPost) : rawPost;

  const [toSeenFrom, preSeenFrom, postSeenFrom] = turnsSeenFrom(fromQ, [toQ, preQ, postQ]);
  const fromSide = cubicTurnFrom(
    fromQ,
    { from: NO_TURN, to: toSeenFrom!, pre: preSeenFrom!, post: postSeenFrom! },
    weight,
    times
  );
  const [fromSeenFromTo, preSeenFromTo, postSeenFromTo] = turnsSeenFrom(toQ, [fromQ, preQ, postQ]);
  const toSide = cubicTurnFrom(
    toQ,
    { from: fromSeenFromTo!, to: NO_TURN, pre: preSeenFromTo!, post: postSeenFromTo! },
    weight,
    times
  );
  return quaternionSlerp(fromSide, toSide, weight);
}
