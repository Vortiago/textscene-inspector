/** Godot's `AABB`: a box from its least corner, with a size that is never negative once built. */

interface AabbCorner {
  x: number;
  y: number;
  z: number;
}

export interface Aabb {
  position: AabbCorner;
  size: AabbCorner;
}

/** `AABB::has_surface` (`core/math/aabb.h:53-55`): whether any side of a box of this size is positive. */
export function hasSurface(size: AabbCorner): boolean {
  return size.x > 0 || size.y > 0 || size.z > 0;
}

/** `AABB()`: the box with no surface, at the origin. */
export const EMPTY_AABB: Aabb = Object.freeze({
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
  size: Object.freeze({ x: 0, y: 0, z: 0 }),
});

/** `AABB(-size / 2, size)`: the box of `size` centred on the origin, as the box gizmos build it. */
export function centredAabb(size: AabbCorner): Aabb {
  return { position: { x: -size.x / 2, y: -size.y / 2, z: -size.z / 2 }, size };
}

/** `AABB::get_center` (`core/math/aabb.h:131-133`): the middle of the box. */
export function aabbCenter({ position, size }: Aabb): AabbCorner {
  return { x: position.x + size.x * 0.5, y: position.y + size.y * 0.5, z: position.z + size.z * 0.5 };
}

/**
 * `AABB::get_edge` for edges 0 to 11 (`core/math/aabb.cpp:357-417`): each edge's start then its
 * end, as 72 flat `xyz` floats, in the engine's order.
 */
export function aabbEdges({ position, size }: Aabb): number[] {
  const { x: x0, y: y0, z: z0 } = position;
  const x1 = x0 + size.x;
  const y1 = y0 + size.y;
  const z1 = z0 + size.z;
  return [
    ...[x1, y0, z0, x0, y0, z0],
    ...[x1, y0, z1, x1, y0, z0],
    ...[x0, y0, z1, x1, y0, z1],
    ...[x0, y0, z0, x0, y0, z1],
    ...[x0, y1, z0, x1, y1, z0],
    ...[x1, y1, z0, x1, y1, z1],
    ...[x1, y1, z1, x0, y1, z1],
    ...[x0, y1, z1, x0, y1, z0],
    ...[x0, y0, z1, x0, y1, z1],
    ...[x0, y0, z0, x0, y1, z0],
    ...[x1, y0, z0, x1, y1, z0],
    ...[x1, y0, z1, x1, y1, z1],
  ];
}

/**
 * `AABB::get_endpoint` (`core/math/aabb.h:244-264`): corner `index` from 0 to 7. Bit 2 of the index
 * adds the X size, bit 1 the Y size and bit 0 the Z size. The engine returns a zero vector and
 * logs an error for another index.
 */
export function aabbEndpoint({ position, size }: Aabb, index: number): AabbCorner {
  if (!Number.isInteger(index) || index < 0 || index > 7) {
    throw new Error(`expected a corner index from 0 to 7, got ${index}`);
  }
  return {
    x: position.x + (index & 4 ? size.x : 0),
    y: position.y + (index & 2 ? size.y : 0),
    z: position.z + (index & 1 ? size.z : 0),
  };
}

/** `AABB::get_longest_axis_size` (`core/math/aabb.h:399-410`): the largest of the three sizes. */
export function aabbLongestAxisSize({ size }: Aabb): number {
  return Math.max(size.x, size.y, size.z);
}

/** `AABB::merge_with` (`core/math/aabb.cpp:40-64`): the box that holds both. */
export function mergeAabb(a: Aabb, b: Aabb): Aabb {
  const min = (axis: keyof AabbCorner) => Math.min(a.position[axis], b.position[axis]);
  const max = (axis: keyof AabbCorner) =>
    Math.max(a.position[axis] + a.size[axis], b.position[axis] + b.size[axis]);
  const position = { x: min('x'), y: min('y'), z: min('z') };
  return {
    position,
    size: { x: max('x') - position.x, y: max('y') - position.y, z: max('z') - position.z },
  };
}

/** Whether a box is `AABB()`, which a custom box setter takes as none. */
export function isEmptyAabb({ position, size }: Aabb): boolean {
  return [position.x, position.y, position.z, size.x, size.y, size.z].every((c) => c === 0);
}

/**
 * `Transform3D::xform(const AABB &)` (`core/math/transform_3d.h:209-231`): the box that holds `aabb`
 * under `transform`, given as 12 floats, each basis row followed by its origin component.
 */
export function transformAabb(transform: ArrayLike<number>, { position, size }: Aabb): Aabb {
  const min = [position.x, position.y, position.z];
  const max = [position.x + size.x, position.y + size.y, position.z + size.z];
  const low = [0, 0, 0];
  const high = [0, 0, 0];
  for (let row = 0; row < 3; row++) {
    low[row] = high[row] = transform[row * 4 + 3]!;
    for (let column = 0; column < 3; column++) {
      const a = transform[row * 4 + column]! * min[column]!;
      const b = transform[row * 4 + column]! * max[column]!;
      low[row]! += Math.min(a, b);
      high[row]! += Math.max(a, b);
    }
  }
  return {
    position: { x: low[0]!, y: low[1]!, z: low[2]! },
    size: { x: high[0]! - low[0]!, y: high[1]! - low[1]!, z: high[2]! - low[2]! },
  };
}

/**
 * The box of `xyz` points, the first point's box grown by `AABB::expand_to` for each other
 * (`scene/resources/3d/primitive_meshes.cpp:58-70`). `AABB()` for no points.
 */
export function aabbOfPoints(points: ArrayLike<number>): Aabb {
  if (points.length < 3) return EMPTY_AABB;
  const min = [points[0]!, points[1]!, points[2]!];
  const max = [...min];
  for (let i = 3; i + 2 < points.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis]!, points[i + axis]!);
      max[axis] = Math.max(max[axis]!, points[i + axis]!);
    }
  }
  return {
    position: { x: min[0]!, y: min[1]!, z: min[2]! },
    size: { x: max[0]! - min[0]!, y: max[1]! - min[1]!, z: max[2]! - min[2]! },
  };
}
