import { hasSurface, type Aabb } from '../../math/aabb.js';
import { cMin } from '../../math/math.js';
import { planeDistanceTo, type Plane } from '../../math/plane.js';
import { isEqualApproxf } from '../../math/realMath.js';
import { vector3Add, vector3Scaled, vector3Sub, type Vector3 } from '../../math/vector.js';
import type { CastArgument } from '../utility/utilityArguments.js';
import { NIL, variant, type Variant } from '../value/variant.js';
import { methodPort, type MethodParameter, type MethodPort } from './methodPort.js';
import { firstMaximumIndex } from './vectorPorts.js';

const f = Math.fround;
const AXES = ['x', 'y', 'z'] as const;
type Axis = (typeof AXES)[number];

const ZERO: Vector3 = { x: 0, y: 0, z: 0 };
const UNIT_AXES: readonly Vector3[] = [
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
];
const RAY_FAR = f(1e20);

const aabbOf = (aabb: Aabb): Variant => variant('AABB', aabb);
const point = (v: Vector3): Variant => variant('VECTOR3', v);
const bool = (value: boolean): Variant => variant('BOOL', value);
const real = (value: number): Variant => variant('FLOAT', value);
const aabbAt = (args: readonly CastArgument[], index: number) => (args[index] as Variant).value as Aabb;
const pointAt = (args: readonly CastArgument[], index: number) => (args[index] as Variant).value as Vector3;
const vectorOf = (components: readonly number[]): Vector3 => ({
  x: components[0]!,
  y: components[1]!,
  z: components[2]!,
});
const componentsOf = (v: Vector3) => AXES.map((axis) => v[axis]);

const port = (
  parameters: readonly MethodParameter[],
  body: (box: Aabb, args: readonly CastArgument[]) => Variant
) => methodPort(parameters, (base, args) => body(base.value as Aabb, args));

const endOf = ({ position, size }: Aabb) => vector3Add(position, size);
const between = (begin: Vector3, end: Vector3): Aabb => ({ position: begin, size: vector3Sub(end, begin) });
const eachAxis = (map: (axis: Axis) => number): Vector3 => vectorOf(AXES.map(map));

function merge(box: Aabb, other: Aabb): Aabb {
  const [begin1, begin2] = [box.position, other.position];
  const [end1, end2] = [vector3Add(box.size, begin1), vector3Add(other.size, begin2)];
  return between(
    eachAxis((axis) => (begin1[axis] < begin2[axis] ? begin1[axis] : begin2[axis])),
    eachAxis((axis) => (end1[axis] > end2[axis] ? end1[axis] : end2[axis]))
  );
}

// aabb.cpp:85: an axis that misses gives the all-zero box.
function intersection(box: Aabb, other: Aabb): Aabb {
  const [sourceEnd, otherEnd] = [endOf(box), endOf(other)];
  const isMiss = AXES.some(
    (axis) => box.position[axis] > otherEnd[axis] || sourceEnd[axis] < other.position[axis]
  );
  if (isMiss) return { position: ZERO, size: ZERO };
  return between(
    eachAxis((axis) =>
      box.position[axis] > other.position[axis] ? box.position[axis] : other.position[axis]
    ),
    eachAxis((axis) => (sourceEnd[axis] < otherEnd[axis] ? sourceEnd[axis] : otherEnd[axis]))
  );
}

function intersects(box: Aabb, other: Aabb): boolean {
  const [end, otherEnd] = [endOf(box), endOf(other)];
  return AXES.every(
    (axis) => !(box.position[axis] >= otherEnd[axis]) && !(end[axis] <= other.position[axis])
  );
}

function encloses(box: Aabb, other: Aabb): boolean {
  const [end, otherEnd] = [endOf(box), endOf(other)];
  return AXES.every((axis) => box.position[axis] <= other.position[axis] && end[axis] >= otherEnd[axis]);
}

function hasPoint(box: Aabb, to: Vector3): boolean {
  const end = endOf(box);
  return (
    AXES.every((axis) => !(to[axis] < box.position[axis])) && AXES.every((axis) => !(to[axis] > end[axis]))
  );
}

function expand(box: Aabb, to: Vector3): Aabb {
  const end = endOf(box);
  return between(
    eachAxis((axis) => (to[axis] < box.position[axis] ? to[axis] : box.position[axis])),
    eachAxis((axis) => (to[axis] > end[axis] ? to[axis] : end[axis]))
  );
}

function endpoint({ position, size }: Aabb, index: number): Vector3 {
  if (index < 0 || index > 7) return ZERO;
  return {
    x: index & 4 ? f(position.x + size.x) : position.x,
    y: index & 2 ? f(position.y + size.y) : position.y,
    z: index & 1 ? f(position.z + size.z) : position.z,
  };
}

function intersectsPlane(box: Aabb, plane: Plane): boolean {
  const distances = [0, 1, 2, 3, 4, 5, 6, 7].map((index) => planeDistanceTo(plane, endpoint(box, index)));
  return distances.some((distance) => distance > 0) && distances.some((distance) => !(distance > 0));
}

// aabb.h:399: a later axis wins only when strictly larger, so a NaN size keeps the earlier axis.
const shortestIndex = ([x, y, z]: readonly number[]) => {
  let index = 0;
  let shortest = x!;
  if (y! < shortest) [index, shortest] = [1, y!];
  if (z! < shortest) index = 2;
  return index;
};

function intersectsRay(box: Aabb, from: Vector3, direction: Vector3): Vector3 | undefined {
  const end = endOf(box);
  let [nearest, farthest, axis] = [-RAY_FAR, RAY_FAR, 0];
  for (const [index, name] of AXES.entries()) {
    if (direction[name] === 0) {
      if (from[name] < box.position[name] || from[name] > end[name]) return undefined;
      continue;
    }
    let near = f(f(box.position[name] - from[name]) / direction[name]);
    let far = f(f(end[name] - from[name]) / direction[name]);
    if (near > far) [near, far] = [far, near];
    if (near >= nearest) [nearest, axis] = [near, index];
    if (far < farthest) {
      if (far < 0) return undefined;
      farthest = far;
    }
    if (nearest > farthest) return undefined;
  }
  // aabb.cpp:446: a ray that starts inside gives its origin.
  if (nearest < 0) return from;
  const hit = vector3Add(from, vector3Scaled(direction, nearest));
  const name = AXES[axis]!;
  return { ...hit, [name]: direction[name] >= 0 ? box.position[name] : end[name] };
}

function intersectsSegment(box: Aabb, from: Vector3, to: Vector3): Vector3 | undefined {
  let [nearest, farthest] = [0, 1];
  for (const name of AXES) {
    const [start, stop] = [from[name], to[name]];
    const begin = box.position[name];
    const end = f(begin + box.size[name]);
    const length = f(stop - start);
    let [near, far] = [0, 1];
    if (start < stop) {
      if (start > end || stop < begin) return undefined;
      if (start < begin) near = f(f(begin - start) / length);
      if (stop > end) far = f(f(end - start) / length);
    } else {
      if (stop > end || start < begin) return undefined;
      if (start > end) near = f(f(end - start) / length);
      if (stop < begin) far = f(f(begin - start) / length);
    }
    if (near > nearest) nearest = near;
    if (far < farthest) farthest = far;
    if (farthest < nearest) return undefined;
  }
  return vector3Add(from, vector3Scaled(vector3Sub(to, from), nearest));
}

const pointOrNil = (found: Vector3 | undefined) => (found ? point(found) : NIL);
const sizes = (box: Aabb) => componentsOf(box.size);

export const AABB_METHODS: Readonly<Record<string, MethodPort>> = {
  abs: port([], ({ position, size }) =>
    aabbOf({
      position: vector3Add(
        position,
        eachAxis((axis) => cMin(size[axis], 0))
      ),
      size: eachAxis((axis) => Math.abs(size[axis])),
    })
  ),
  get_center: port([], ({ position, size }) => point(vector3Add(position, vector3Scaled(size, 0.5)))),
  get_volume: port([], ({ size }) => real(f(f(size.x * size.y) * size.z))),
  has_volume: port([], ({ size }) => bool(AXES.every((axis) => size[axis] > 0))),
  has_surface: port([], ({ size }) => bool(hasSurface(size))),
  has_point: port(['VECTOR3'], (box, args) => bool(hasPoint(box, pointAt(args, 0)))),
  is_equal_approx: port(['AABB'], (box, args) => {
    const other = aabbAt(args, 0);
    const pairs = [...componentsOf(box.position), ...sizes(box)].map(
      (component, index) => [component, [...componentsOf(other.position), ...sizes(other)][index]!] as const
    );
    return bool(pairs.every(([a, b]) => isEqualApproxf(a, b)));
  }),
  is_finite: port([], (box) => bool([...componentsOf(box.position), ...sizes(box)].every(Number.isFinite))),
  intersects: port(['AABB'], (box, args) => bool(intersects(box, aabbAt(args, 0)))),
  encloses: port(['AABB'], (box, args) => bool(encloses(box, aabbAt(args, 0)))),
  intersects_plane: port(['PLANE'], (box, args) =>
    bool(intersectsPlane(box, (args[0] as Variant).value as Plane))
  ),
  intersection: port(['AABB'], (box, args) => aabbOf(intersection(box, aabbAt(args, 0)))),
  merge: port(['AABB'], (box, args) => aabbOf(merge(box, aabbAt(args, 0)))),
  expand: port(['VECTOR3'], (box, args) => aabbOf(expand(box, pointAt(args, 0)))),
  grow: port(['float'], ({ position, size }, args) => {
    const amount = args[0] as number;
    return aabbOf({
      position: eachAxis((axis) => f(position[axis] - amount)),
      size: eachAxis((axis) => f(size[axis] + f(2 * amount))),
    });
  }),
  get_support: port(['VECTOR3'], ({ position, size }, args) => {
    const direction = pointAt(args, 0);
    return point(eachAxis((axis) => (direction[axis] > 0 ? f(position[axis] + size[axis]) : position[axis])));
  }),
  get_longest_axis: port([], (box) => point(UNIT_AXES[firstMaximumIndex(sizes(box))]!)),
  get_longest_axis_index: port([], (box) => variant('INT', BigInt(firstMaximumIndex(sizes(box))))),
  get_longest_axis_size: port([], (box) => real(sizes(box)[firstMaximumIndex(sizes(box))]!)),
  get_shortest_axis: port([], (box) => point(UNIT_AXES[shortestIndex(sizes(box))]!)),
  get_shortest_axis_index: port([], (box) => variant('INT', BigInt(shortestIndex(sizes(box))))),
  get_shortest_axis_size: port([], (box) => real(sizes(box)[shortestIndex(sizes(box))]!)),
  get_endpoint: port(['int32_t'], (box, args) => point(endpoint(box, args[0] as number))),
  intersects_segment: port(['VECTOR3', 'VECTOR3'], (box, args) =>
    pointOrNil(intersectsSegment(box, pointAt(args, 0), pointAt(args, 1)))
  ),
  intersects_ray: port(['VECTOR3', 'VECTOR3'], (box, args) =>
    pointOrNil(intersectsRay(box, pointAt(args, 0), pointAt(args, 1)))
  ),
};
