import { isZeroApprox, UNIT_EPSILON } from '../../math/math.js';
import type { Plane } from '../../math/plane.js';
import {
  normalizedQuaternion,
  QUATERNION_IDENTITY,
  quaternionFromAxisAngle,
  type Quaternion,
} from '../../math/quaternion.js';
import { storedReal as f } from '../../math/real.js';
import type { Transform2DColumns } from '../../math/transform2d.js';
import {
  normalizedVector3,
  vector3Cross,
  vector3Dot,
  vector3LengthSquared,
  vector3Sub,
  type Vector2,
  type Vector3,
} from '../../math/vector.js';

type V3 = Readonly<Vector3>;

const sinf = (x: number) => f(Math.sin(x));
const cosf = (x: number) => f(Math.cos(x));
const tuple = (v: V3) => [v.x, v.y, v.z] as const;
const vector = ([x, y, z]: readonly number[]): Vector3 => ({ x: x!, y: y!, z: z! });
const normalized = (v: V3) => vector(normalizedVector3(v.x, v.y, v.z));
const cross = (a: V3, b: V3) => vector(vector3Cross(tuple(a), tuple(b)));
const dot = (a: V3, b: V3) => vector3Dot(tuple(a), tuple(b));

// Math::is_equal_approx(a, b, tolerance) (math_funcs.h:520).
const isEqualWithin = (a: number, b: number, tolerance: number) => a === b || Math.abs(f(a - b)) < tolerance;

const isNormalized3 = (v: V3) => isEqualWithin(vector3LengthSquared(v.x, v.y, v.z), 1, UNIT_EPSILON);

export function transform2DFromRotation(rotation: number, position: Readonly<Vector2>): Transform2DColumns {
  const cr = cosf(rotation);
  const sr = sinf(rotation);
  return { a: cr, b: sr, c: -sr, d: cr, tx: position.x, ty: position.y };
}

// Not math's transform2DFromParts: Godot's `-sin * scale` keeps the -0 that one turns into +0.
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

/** MATH_CHECKS refuses an axis that is not normalised and leaves Quaternion(). */
export function checkedQuaternionFromAxisAngle(axis: V3, angle: number): Quaternion {
  return isNormalized3(axis) ? quaternionFromAxisAngle(axis, angle) : QUATERNION_IDENTITY;
}

// The arc's limit for parallel vectors (quaternion.h:138).
const ALMOST_ONE = f(0.99999975);
const isZeroApprox3 = (v: V3) => isZeroApprox(v.x) && isZeroApprox(v.y) && isZeroApprox(v.z);

// Vector3::get_any_perpendicular (vector3.h:375): the cross with RIGHT or UP, whichever is less parallel.
function anyPerpendicular(v: V3): Vector3 {
  if (isZeroApprox3(v)) return { x: 0, y: 0, z: 0 };
  const isRight = Math.abs(v.x) <= Math.abs(v.y) && Math.abs(v.x) <= Math.abs(v.z);
  return normalized(cross(v, isRight ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }));
}

/** The shortest arc, normalised. MATH_CHECKS refuses a zero vector and leaves Quaternion(). */
export function quaternionArc(from: V3, to: V3): Quaternion {
  if (isZeroApprox3(from) || isZeroApprox3(to)) return QUATERNION_IDENTITY;
  return normalizedQuaternion(arcOf(from, to));
}

function arcOf(from: V3, to: V3): Quaternion {
  const n0 = normalized(from);
  const n1 = normalized(to);
  const d = dot(n0, n1);
  if (Math.abs(d) > ALMOST_ONE) return d >= 0 ? QUATERNION_IDENTITY : { ...anyPerpendicular(n0), w: 0 };
  const c = cross(n0, n1);
  const s = f(Math.sqrt(f(f(1 + d) * 2)));
  const rs = f(1 / s);
  return { x: f(c.x * rs), y: f(c.y * rs), z: f(c.z * rs), w: f(s * 0.5) };
}

export function planeFromNormalPoint(normal: V3, point: V3): Plane {
  return { normal, d: dot(normal, point) };
}

// Plane(p1, p2, p3, CLOCKWISE) (plane.h:124).
export function planeFromPoints(a: V3, b: V3, c: V3): Plane {
  const normal = normalized(cross(vector3Sub(a, c), vector3Sub(a, b)));
  return { normal, d: dot(normal, a) };
}
