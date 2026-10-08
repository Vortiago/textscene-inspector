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
