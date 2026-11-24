import { normalizedPlane, planeDistanceTo, type Plane } from '../../math/plane.js';
import { CMP_EPSILON_FLOAT, isEqualApproxf, isZeroApproxf } from '../../math/realMath.js';
import {
  vector3Add,
  vector3Cross,
  vector3Div,
  vector3Dot,
  vector3Scaled,
  vector3Sub,
  type Vector3,
} from '../../math/vector.js';
import { valueAt } from '../utility/utilityArguments.js';
import { bool, variant, vector3, vector3OrNil, type Variant } from '../value/variant.js';
import { portOn, valueOf, type MethodPort } from './methodPort.js';

const f = Math.fround;

const tuple = ({ x, y, z }: Vector3) => [x, y, z] as const;
const dot = (a: Vector3, b: Vector3) => vector3Dot(tuple(a), tuple(b));
const cross = (a: Vector3, b: Vector3): Vector3 => {
  const [x, y, z] = vector3Cross(tuple(a), tuple(b));
  return { x, y, z };
};
const divided = (v: Vector3, by: number) => vector3Div(v, { x: by, y: by, z: by });

const planeOf = (plane: Plane): Variant => variant('PLANE', plane);
const planeAt = valueAt<Plane>;
const pointAt = valueAt<Vector3>;

const port = portOn(valueOf<Plane>);

const isFiniteVector = ({ x, y, z }: Vector3) =>
  Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);

function intersect3(plane0: Plane, plane1: Plane, plane2: Plane): Vector3 | undefined {
  const [n0, n1, n2] = [plane0.normal, plane1.normal, plane2.normal];
  const denominator = dot(cross(n0, n1), n2);
  if (isZeroApproxf(denominator)) return undefined;
  const sum = vector3Add(
    vector3Add(vector3Scaled(cross(n1, n2), plane0.d), vector3Scaled(cross(n2, n0), plane1.d)),
    vector3Scaled(cross(n0, n1), plane2.d)
  );
  return divided(sum, denominator);
}

function intersectsRay({ normal, d }: Plane, from: Vector3, direction: Vector3): Vector3 | undefined {
  const denominator = dot(normal, direction);
  if (isZeroApproxf(denominator)) return undefined;
  const distance = f(f(dot(normal, from) - d) / denominator);
  if (distance > CMP_EPSILON_FLOAT) return undefined;
  return vector3Add(from, vector3Scaled(direction, -distance));
}

const SEGMENT_END = f(1 + CMP_EPSILON_FLOAT);

function intersectsSegment({ normal, d }: Plane, begin: Vector3, end: Vector3): Vector3 | undefined {
  const segment = vector3Sub(begin, end);
  const denominator = dot(normal, segment);
  if (isZeroApproxf(denominator)) return undefined;
  const distance = f(f(dot(normal, begin) - d) / denominator);
  if (distance < -CMP_EPSILON_FLOAT || distance > SEGMENT_END) return undefined;
  return vector3Add(begin, vector3Scaled(segment, -distance));
}

// plane.cpp:156: a miss gives a null Variant.

export const PLANE_METHODS: Readonly<Record<string, MethodPort>> = {
  normalized: port([], (p) => planeOf(normalizedPlane(p))),
  get_center: port([], (p) => vector3(vector3Scaled(p.normal, p.d))),
  is_equal_approx: port(['PLANE'], (p, args) => {
    const other = planeAt(args, 0);
    const pairs: [number, number][] = [
      [p.normal.x, other.normal.x],
      [p.normal.y, other.normal.y],
      [p.normal.z, other.normal.z],
      [p.d, other.d],
    ];
    return bool(pairs.every(([a, b]) => isEqualApproxf(a, b)));
  }),
  is_finite: port([], (p) => bool(isFiniteVector(p.normal) && Number.isFinite(p.d))),
  is_point_over: port(['VECTOR3'], (p, args) => bool(dot(p.normal, pointAt(args, 0)) > p.d)),
  distance_to: port(['VECTOR3'], (p, args) => variant('FLOAT', planeDistanceTo(p, pointAt(args, 0)))),
  has_point: port(['VECTOR3', 'float'], (p, args) =>
    bool(Math.abs(planeDistanceTo(p, pointAt(args, 0))) <= (args[1] as number))
  ),
  project: port(['VECTOR3'], (p, args) => {
    const to = pointAt(args, 0);
    return vector3(vector3Sub(to, vector3Scaled(p.normal, planeDistanceTo(p, to))));
  }),
  intersect_3: port(['PLANE', 'PLANE'], (p, args) =>
    vector3OrNil(intersect3(p, planeAt(args, 0), planeAt(args, 1)))
  ),
  intersects_ray: port(['VECTOR3', 'VECTOR3'], (p, args) =>
    vector3OrNil(intersectsRay(p, pointAt(args, 0), pointAt(args, 1)))
  ),
  intersects_segment: port(['VECTOR3', 'VECTOR3'], (p, args) =>
    vector3OrNil(intersectsSegment(p, pointAt(args, 0), pointAt(args, 1)))
  ),
};
