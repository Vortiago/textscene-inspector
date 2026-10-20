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
