/** Godot's `Quaternion` (`core/math/quaternion.h`) as plain components, and the operations a pose edit reads. */

// Float arithmetic: each `f(...)` rounds as a C++ `float` operation does.
import { basisFromQuaternion, basisGetRotationQuaternion } from './basis.js';
import { CMP_EPSILON, cubicInterpolateInTimef } from './math.js';
import { storedReal as f } from './real.js';
import { normalizedVector3, vector3Dot, vector3Length, type KeyTimes, type Vector3 } from './vector.js';

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
  let cosine = f(f(f(from.x * to.x) + f(from.y * to.y)) + f(f(from.z * to.z) + f(from.w * to.w)));
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
function quaternionDot(a: Quaternion, b: Quaternion): number {
  return f(f(f(a.x * b.x) + f(a.y * b.y)) + f(f(a.z * b.z) + f(a.w * b.w)));
}

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
function quaternionLog({ x, y, z, w }: Quaternion): Quaternion {
  const angle = f(2 * f(acosClamped(w)));
  const scale = Math.abs(w) > 1 - CMP_EPSILON ? 1 : f(1 / f(Math.sqrt(f(1 - f(w * w)))));
  return { x: f(f(x * scale) * angle), y: f(f(y * scale) * angle), z: f(f(z * scale) * angle), w: 0 };
}

/** `UNIT_EPSILON` (`math_defs.h:65`), the tolerance of `Vector3::is_normalized` in an official build. */
const UNIT_EPSILON = 0.001;

/** `Quaternion::exp` (`quaternion.cpp:90-99`): the turn about the vector part by its length, or no turn. */
function quaternionExp({ x, y, z }: Quaternion): Quaternion {
  const theta = vector3Length(x, y, z);
  const axis = normalizedVector3(x, y, z);
  const isUnitAxis = Math.abs(vector3Dot(axis, axis) - 1) < UNIT_EPSILON;
  if (theta < CMP_EPSILON || !isUnitAxis) return { x: 0, y: 0, z: 0, w: 1 };
  return quaternionFromAxisAngle({ x: axis[0], y: axis[1], z: axis[2] }, theta);
}

/** The expmap of `target`, `pre` and `post` seen from `base`, as each cubic of `spherical_cubic_interpolate_in_time` sees them. */
function turnsSeenFrom(base: Quaternion, quaternions: readonly Quaternion[]): Quaternion[] {
  const baseInverse = quaternionInverse(base);
  return quaternions.map((quaternion) => quaternionLog(quaternionMultiply(baseInverse, quaternion)));
}

/** One cubic through the turns of `from`, `to`, `pre` and `post` taken in the space of `base`, applied on `base`. */
function cubicTurnFrom(
  base: Quaternion,
  turns: { from: Quaternion; to: Quaternion; pre: Quaternion; post: Quaternion },
  weight: number,
  { toT, preT, postT }: KeyTimes
): Quaternion {
  const axis = (component: 'x' | 'y' | 'z') =>
    cubicInterpolateInTimef(
      turns.from[component],
      turns.to[component],
      turns.pre[component],
      turns.post[component],
      weight,
      toT,
      preT,
      postT
    );
  return quaternionMultiply(base, quaternionExp({ x: axis('x'), y: axis('y'), z: axis('z'), w: 0 }));
}

/** `Basis(quaternion).get_rotation_quaternion()`: the quaternion with its flip phase aligned. */
function rotationOf(quaternion: Quaternion): Quaternion {
  return basisGetRotationQuaternion(basisFromQuaternion(quaternion));
}

const NO_TURN: Quaternion = { x: 0, y: 0, z: 0, w: 0 };

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
