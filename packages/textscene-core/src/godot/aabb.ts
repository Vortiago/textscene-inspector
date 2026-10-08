/** Godot's `AABB`: a box from its least corner, with a size that is never negative once built. */

export interface AabbCorner {
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
