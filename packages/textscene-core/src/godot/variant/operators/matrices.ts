import type { Aabb } from '../../math/aabb.js';
import { basisInvert, type BasisComponents } from '../../math/basis.js';
import { basisXform } from '../../math/basisFloat.js';
import type { Plane } from '../../math/plane.js';
import { quaternionIsNormalized, type Quaternion } from '../../math/quaternion.js';
import { storedReal as f } from '../../math/real.js';
import type { Rect2 } from '../../math/rect2.js';
import { transform2DXform, type Transform2DColumns } from '../../math/transform2d.js';
import {
  affineInverseTransform3D,
  basisOfTransform3D,
  transform3DOf,
  transform3DXform,
  type Transform3D,
} from '../../math/transform3d.js';
import type { Vector2, Vector3 } from '../../math/vector.js';
import type { ProjectionValue, Vector4Value } from '../value/variant.js';

type V2 = Readonly<Vector2>;
type V3 = Readonly<Vector3>;

const dot2 = (a: V2, b: V2) => f(f(a.x * b.x) + f(a.y * b.y));
const dot3 = (a: V3, b: V3) => f(f(f(a.x * b.x) + f(a.y * b.y)) + f(a.z * b.z));
const sub2 = (a: V2, b: V2): V2 => ({ x: f(a.x - b.x), y: f(a.y - b.y) });
const add2 = (a: V2, b: V2): V2 => ({ x: f(a.x + b.x), y: f(a.y + b.y) });
const sub3 = (a: V3, b: V3): V3 => ({ x: f(a.x - b.x), y: f(a.y - b.y), z: f(a.z - b.z) });
const add3 = (a: V3, b: V3): V3 => ({ x: f(a.x + b.x), y: f(a.y + b.y), z: f(a.z + b.z) });
const scale2 = (a: V2, s: number): V2 => ({ x: f(a.x * s), y: f(a.y * s) });
const scale3 = (a: V3, s: number): V3 => ({ x: f(a.x * s), y: f(a.y * s), z: f(a.z * s) });
const divide3 = (a: V3, s: number): V3 => ({ x: f(a.x / s), y: f(a.y / s), z: f(a.z / s) });
const cross3 = (a: V3, b: V3): V3 => ({
  x: f(f(a.y * b.z) - f(a.z * b.y)),
  y: f(f(a.z * b.x) - f(a.x * b.z)),
  z: f(f(a.x * b.y) - f(a.y * b.x)),
});

function normalized3(v: V3): V3 {
  const lengthSquared = dot3(v, v);
  if (lengthSquared === 0) return { x: 0, y: 0, z: 0 };
  return divide3(v, f(Math.sqrt(lengthSquared)));
}

const column0 = (t: Transform2DColumns): V2 => ({ x: t.a, y: t.b });
const column1 = (t: Transform2DColumns): V2 => ({ x: t.c, y: t.d });
const origin2 = (t: Transform2DColumns): V2 => ({ x: t.tx, y: t.ty });

export function transform2DXformInv(t: Transform2DColumns, v: V2): V2 {
  const local = sub2(v, origin2(t));
  return { x: dot2(column0(t), local), y: dot2(column1(t), local) };
}

export function scaleTransform2D(t: Transform2DColumns, s: number): Transform2DColumns {
  return { a: f(t.a * s), b: f(t.b * s), c: f(t.c * s), d: f(t.d * s), tx: f(t.tx * s), ty: f(t.ty * s) };
}

export function divideTransform2D(t: Transform2DColumns, s: number): Transform2DColumns {
  return { a: f(t.a / s), b: f(t.b / s), c: f(t.c / s), d: f(t.d / s), tx: f(t.tx / s), ty: f(t.ty / s) };
}

// Rect2::expand_to (rect2.h:254).
function expandRect(rect: Rect2, point: V2): Rect2 {
  const end = add2({ x: rect.x, y: rect.y }, { x: rect.w, y: rect.h });
  const begin = { x: point.x < rect.x ? point.x : rect.x, y: point.y < rect.y ? point.y : rect.y };
  const last = { x: point.x > end.x ? point.x : end.x, y: point.y > end.y ? point.y : end.y };
  const size = sub2(last, begin);
  return { x: begin.x, y: begin.y, w: size.x, h: size.y };
}

export function transform2DXformRect(t: Transform2DColumns, rect: Rect2): Rect2 {
  const x = scale2(column0(t), rect.w);
  const y = scale2(column1(t), rect.h);
  const position = transform2DXform(t, { x: rect.x, y: rect.y });
  let result: Rect2 = { x: position.x, y: position.y, w: 0, h: 0 };
  for (const corner of [add2(position, x), add2(position, y), add2(add2(position, x), y)])
    result = expandRect(result, corner);
  return result;
}

export function transform2DXformInvRect(t: Transform2DColumns, rect: Rect2): Rect2 {
  const right = f(rect.x + rect.w);
  const bottom = f(rect.y + rect.h);
  const ends = [
    { x: rect.x, y: rect.y },
    { x: rect.x, y: bottom },
    { x: right, y: bottom },
    { x: right, y: rect.y },
  ].map((corner) => transform2DXformInv(t, corner));
  const first = ends[0]!;
  return ends.slice(1).reduce(expandRect, { x: first.x, y: first.y, w: 0, h: 0 });
}

// The column sums of basis.h:343, which xform_inv and the matrix product (tdotx/y/z) share.
function columnDot(n: BasisComponents, column: number, v: V3): number {
  return f(f(f(n[column]! * v.x) + f(n[3 + column]! * v.y)) + f(n[6 + column]! * v.z));
}

export function basisXformInvVector(n: BasisComponents, v: V3): V3 {
  return { x: columnDot(n, 0, v), y: columnDot(n, 1, v), z: columnDot(n, 2, v) };
}

export function scaleBasis(n: BasisComponents, s: number): BasisComponents {
  return n.map((component) => f(component * s)) as unknown as BasisComponents;
}

export function divideBasis(n: BasisComponents, s: number): BasisComponents {
  return n.map((component) => f(component / s)) as unknown as BasisComponents;
}

export function transposeBasis(n: BasisComponents): BasisComponents {
  return [n[0], n[3], n[6], n[1], n[4], n[7], n[2], n[5], n[8]];
}

export function transform3DXformInvVector(t: Readonly<Transform3D>, v: V3): V3 {
  return basisXformInvVector(basisOfTransform3D(t), sub3(v, t.origin));
}

export function scaleTransform3D(t: Readonly<Transform3D>, s: number): Transform3D {
  return transform3DOf(scaleBasis(basisOfTransform3D(t), s), scale3(t.origin, s));
}

export function divideTransform3D(t: Readonly<Transform3D>, s: number): Transform3D {
  return transform3DOf(divideBasis(basisOfTransform3D(t), s), divide3(t.origin, s));
}

// Transform3D::xform_fast and xform_inv_fast: a point on the plane and the normal go through apart.
function planeThrough(point: V3, normal: V3): Plane {
  const unit = normalized3(normal);
  return { normal: unit, d: dot3(unit, point) };
}

export function transform3DXformPlane(t: Readonly<Transform3D>, plane: Plane): Plane {
  const inverseTranspose = transposeBasis(basisInvert(basisOfTransform3D(t)));
  const point = transform3DXform(t, scale3(plane.normal, plane.d));
  return planeThrough(point, basisXform(inverseTranspose, plane.normal));
}

export function transform3DXformInvPlane(t: Readonly<Transform3D>, plane: Plane): Plane {
  const point = transform3DXform(affineInverseTransform3D(t), scale3(plane.normal, plane.d));
  return planeThrough(point, basisXform(transposeBasis(basisOfTransform3D(t)), plane.normal));
}

const AXES = ['x', 'y', 'z'] as const;

export function transform3DXformAabb(t: Readonly<Transform3D>, box: Readonly<Aabb>): Aabb {
  const n = basisOfTransform3D(t);
  const min = box.position;
  const max = add3(box.position, box.size);
  const low = { ...t.origin };
  const high = { ...t.origin };
  AXES.forEach((axis, i) => {
    AXES.forEach((source, j) => {
      const e = f(n[i * 3 + j]! * min[source]);
      const g = f(n[i * 3 + j]! * max[source]);
      low[axis] = f(low[axis] + (e < g ? e : g));
      high[axis] = f(high[axis] + (e < g ? g : e));
    });
  });
  return { position: low, size: sub3(high, low) };
}

// AABB::expand_to (aabb.h).
function expandAabb(box: Aabb, point: V3): Aabb {
  const end = add3(box.position, box.size);
  const begin = { ...box.position };
  const last = { ...end };
  for (const axis of AXES) {
    if (point[axis] < begin[axis]) begin[axis] = point[axis];
    if (point[axis] > last[axis]) last[axis] = point[axis];
  }
  return { position: begin, size: sub3(last, begin) };
}

export function transform3DXformInvAabb(t: Readonly<Transform3D>, box: Readonly<Aabb>): Aabb {
  const { position: p, size: s } = box;
  const x = f(p.x + s.x);
  const y = f(p.y + s.y);
  const z = f(p.z + s.z);
  const corners = [
    { x, y, z },
    { x, y, z: p.z },
    { x, y: p.y, z },
    { x, y: p.y, z: p.z },
    { x: p.x, y, z },
    { x: p.x, y, z: p.z },
    { x: p.x, y: p.y, z },
    { x: p.x, y: p.y, z: p.z },
  ].map((corner) => transform3DXformInvVector(t, corner));
  const first = corners[0]!;
  return corners.slice(1).reduce(expandAabb, { position: first, size: { x: 0, y: 0, z: 0 } });
}

const LANES = ['x', 'y', 'z', 'w'] as const;

export function multiplyProjection(a: ProjectionValue, b: ProjectionValue): ProjectionValue {
  return b.map((column) => {
    const result: Record<string, number> = {};
    LANES.forEach((lane) => {
      let sum = 0;
      LANES.forEach((k, kIndex) => (sum = f(sum + f(a[kIndex]![lane] * column[k]))));
      result[lane] = sum;
    });
    return result as unknown as Vector4Value;
  }) as unknown as ProjectionValue;
}

function sumOfProducts(terms: readonly (readonly [number, number])[]): number {
  return terms.reduce((sum, [a, b], index) => (index === 0 ? f(a * b) : f(sum + f(a * b))), 0);
}

export function projectionXform(p: ProjectionValue, v: Vector4Value): Vector4Value {
  const lane = (l: (typeof LANES)[number]) => sumOfProducts(LANES.map((k, i) => [p[i]![l], v[k]] as const));
  return { x: lane('x'), y: lane('y'), z: lane('z'), w: lane('w') };
}

export function projectionXformInv(p: ProjectionValue, v: Vector4Value): Vector4Value {
  const lane = (column: number) => sumOfProducts(LANES.map((k) => [p[column]![k], v[k]] as const));
  return { x: lane(0), y: lane(1), z: lane(2), w: lane(3) };
}

// MATH_CHECKS refuses a quaternion that is not normalised and returns the vector unchanged.
export function quaternionXform(q: Quaternion, v: V3): V3 {
  if (!quaternionIsNormalized(q)) return v;
  const u = { x: q.x, y: q.y, z: q.z };
  const uv = cross3(u, v);
  return add3(v, scale3(add3(scale3(uv, q.w), cross3(u, uv)), 2));
}

// Quaternion::inverse fails MATH_CHECKS on a quaternion that is not normalised and gives Quaternion().
export function quaternionXformInv(q: Quaternion, v: V3): V3 {
  const inverse = quaternionIsNormalized(q)
    ? { x: -q.x, y: -q.y, z: -q.z, w: q.w }
    : { x: 0, y: 0, z: 0, w: 1 };
  return quaternionXform(inverse, v);
}
