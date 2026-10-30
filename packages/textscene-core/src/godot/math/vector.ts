/** Godot's vector types as plain components, for engine facts that import nothing. */

// Float arithmetic: each `f(...)` rounds as a C++ `float` operation does.
import { cubicInterpolateInTimef, lerpf, type KeyTimes } from './math.js';
import { storedReal as f } from './real.js';

/** A point, a size or a direction: two components, as Godot's `Vector2` and `Vector2i` hold them. */
export interface Vector2 {
  x: number;
  y: number;
}

/** A point, a size or a direction: three components, as Godot's `Vector3` and `Vector3i` hold them. */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/** The components of a `Vector3`, in the order Godot indexes them (`v[0]`, `v[1]`, `v[2]`). */
export const VECTOR3_AXES = ['x', 'y', 'z'] as const;

/**
 * The floats of one 3D vertex in a flat array, as a `PackedVector3Array` or a line list holds them.
 *
 * @canonical The floats of a 3D vertex in a flat array
 */
export const FLOATS_PER_VERTEX = 3;

/**
 * `Vector2::length_squared` (`core/math/vector2.h`) in `real_t` float. It is positive exactly when
 * {@link vector2Length} is, so a test for a non-zero vector needs no square root.
 *
 * @canonical A Vector2 length squared in float32
 */
export function vector2LengthSquared({ x, y }: Vector2): number {
  return f(f(x * x) + f(y * y));
}

/**
 * `Vector2::length` (`core/math/vector2.cpp:44-46`) in `real_t` float.
 *
 * @canonical A Vector2 length in float32
 */
export function vector2Length({ x, y }: Vector2): number {
  return f(Math.sqrt(vector2LengthSquared({ x, y })));
}

/**
 * `Vector2::operator+` (`core/math/vector2.h`) in `real_t` float.
 *
 * @canonical A Vector2 sum in float32
 */
export function vector2Add(a: Vector2, b: Vector2): Vector2 {
  return { x: f(a.x + b.x), y: f(a.y + b.y) };
}

/**
 * `Vector2::operator-` (`core/math/vector2.h`) in `real_t` float.
 *
 * @canonical A Vector2 difference in float32
 */
export function vector2Sub(a: Vector2, b: Vector2): Vector2 {
  return { x: f(a.x - b.x), y: f(a.y - b.y) };
}

/**
 * `Vector2::operator*` by a `real_t` (`core/math/vector2.h:239`) in `real_t` float, the factor already a `real_t`.
 *
 * @canonical A Vector2 times a scalar in float32
 */
export function vector2Scaled({ x, y }: Vector2, factor: number): Vector2 {
  return { x: f(x * factor), y: f(y * factor) };
}

/**
 * `Vector2::normalize` (`core/math/vector2.cpp:52-59`) in `real_t` float: a zero vector stays zero.
 *
 * @canonical A unit vector
 */
export function normalizedVector2({ x, y }: Vector2): Vector2 {
  const lengthSquared = f(f(x * x) + f(y * y));
  if (lengthSquared === 0) return { x: 0, y: 0 };
  const length = f(Math.sqrt(lengthSquared));
  return { x: f(x / length), y: f(y / length) };
}

/**
 * `Vector3::normalize` (`core/math/vector3.h:548-558`) in `real_t` float: a zero vector stays zero.
 *
 * @canonical A unit vector
 */
export function normalizedVector3(x: number, y: number, z: number): [number, number, number] {
  const unit = vector3NormalizeInto(normalizeScratch, x, y, z);
  return [unit.x, unit.y, unit.z];
}

/** Scratch for `normalizedVector3`, overwritten by every call. */
const normalizeScratch: Vector3 = { x: 0, y: 0, z: 0 };

/** {@link normalizedVector3} written into `out`, for a loop that allocates nothing. */
export function vector3NormalizeInto(out: Vector3, x: number, y: number, z: number): Vector3 {
  const lengthSquared = vector3LengthSquared(x, y, z);
  if (lengthSquared === 0) return vector3Set(out, 0, 0, 0);
  const length = f(Math.sqrt(lengthSquared));
  return vector3Set(out, f(x / length), f(y / length), f(z / length));
}

/** Writes `x`, `y` and `z` into `out`. */
export function vector3Set(out: Vector3, x: number, y: number, z: number): Vector3 {
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

type Components3 = readonly [number, number, number];

/** `Vector3::dot` (`core/math/vector3.h`) in `real_t` float, the products summed in order. */
export function vector3Dot(a: Components3, b: Components3): number {
  return vector3DotComponents(a[0], a[1], a[2], b[0], b[1], b[2]);
}

/**
 * {@link vector3Dot} of `(ax, ay, az)` and `(bx, by, bz)`, for a caller that holds no tuple, such as
 * a basis column.
 *
 * @canonical A Vector3 dot product in float32
 *   `vector3Dot` over tuples, `vector3DotComponents` over six components, one rounding chain.
 */
export function vector3DotComponents(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): number {
  return f(f(f(ax * bx) + f(ay * by)) + f(az * bz));
}

/** `Vector3::cross` (`core/math/vector3.h`) in `real_t` float. */
export function vector3Cross(a: Components3, b: Components3): [number, number, number] {
  const cross = vector3CrossInto(crossScratch, asVector3(a), asVector3(b));
  return [cross.x, cross.y, cross.z];
}

/** Scratch for `vector3Cross`, overwritten by every call. */
const crossScratch: Vector3 = { x: 0, y: 0, z: 0 };

function asVector3([x, y, z]: Components3): Vector3 {
  return { x, y, z };
}

/**
 * {@link vector3Cross} written into `out`, for a loop that allocates nothing. `out` may be `a` or `b`.
 *
 * @canonical A Vector3 cross product in float32, written in place
 */
export function vector3CrossInto(out: Vector3, a: Vector3, b: Vector3): Vector3 {
  return vector3Set(
    out,
    f(f(a.y * b.z) - f(a.z * b.y)),
    f(f(a.z * b.x) - f(a.x * b.z)),
    f(f(a.x * b.y) - f(a.y * b.x))
  );
}

/** `Vector3::maxf` (`core/math/vector3.h:105-107`): each component raised to at least `floor`. */
export function vector3Maxf({ x, y, z }: Vector3, floor: number): Vector3 {
  return { x: Math.max(x, floor), y: Math.max(y, floor), z: Math.max(z, floor) };
}

/** `Vector3::length` (`core/math/vector3.h:532-538`) in `real_t` float. */
export function vector3Length(x: number, y: number, z: number): number {
  return f(Math.sqrt(vector3LengthSquared(x, y, z)));
}

/**
 * `Vector3::length_squared` (`core/math/vector3.h`) in `real_t` float. The squares sum in order, so
 * a permuted vector can round to another length, as in Godot.
 *
 * @canonical A Vector3 length squared in float32
 */
export function vector3LengthSquared(x: number, y: number, z: number): number {
  return vector3DotComponents(x, y, z, x, y, z);
}

/** `Vector3::operator+` (`core/math/vector3.h`) in `real_t` float. */
export function vector3Add(a: Vector3, b: Vector3): Vector3 {
  return { x: f(a.x + b.x), y: f(a.y + b.y), z: f(a.z + b.z) };
}

/** `Vector3::operator-` (`core/math/vector3.h`) in `real_t` float. */
export function vector3Sub(a: Vector3, b: Vector3): Vector3 {
  return { x: f(a.x - b.x), y: f(a.y - b.y), z: f(a.z - b.z) };
}

/** `Vector3::operator*` by a scalar (`core/math/vector3.h`) in `real_t` float. */
export function vector3Scaled({ x, y, z }: Vector3, factor: number): Vector3 {
  return { x: f(x * factor), y: f(y * factor), z: f(z * factor) };
}

/** `Vector3::operator*` by a vector (`core/math/vector3.h`) in `real_t` float. */
export function vector3Mul(a: Vector3, b: Vector3): Vector3 {
  return { x: f(a.x * b.x), y: f(a.y * b.y), z: f(a.z * b.z) };
}

/** `Vector3::operator/` by a vector (`core/math/vector3.h`) in `real_t` float. */
export function vector3Div(a: Vector3, b: Vector3): Vector3 {
  return { x: f(a.x / b.x), y: f(a.y / b.y), z: f(a.z / b.z) };
}

/**
 * `Vector3::lerp` (`core/math/vector3.h`) in `real_t` float: each component moves `weight` of the way.
 *
 * @canonical A Vector3 between two others
 */
export function vector3Lerp(from: Vector3, to: Vector3, weight: number): Vector3 {
  return {
    x: lerpf(from.x, to.x, weight),
    y: lerpf(from.y, to.y, weight),
    z: lerpf(from.z, to.z, weight),
  };
}

/**
 * `Vector3::cubic_interpolate_in_time` (`core/math/vector3.h:314-320`): each component through
 * `cubicInterpolateInTimef`, from `from` to `to` with `pre` and `post` as the keys around them.
 * `toT`, `preT` and `postT` are the times of `to`, `pre` and `post` counted from `from`.
 *
 * @canonical A Vector3 on a cubic through keys at uneven times
 */
export function vector3CubicInterpolateInTime(
  from: Vector3,
  to: Vector3,
  pre: Vector3,
  post: Vector3,
  weight: number,
  { toT, preT, postT }: KeyTimes
): Vector3 {
  const axis = (component: 'x' | 'y' | 'z') =>
    cubicInterpolateInTimef(
      from[component],
      to[component],
      pre[component],
      post[component],
      weight,
      toT,
      preT,
      postT
    );
  return { x: axis('x'), y: axis('y'), z: axis('z') };
}
