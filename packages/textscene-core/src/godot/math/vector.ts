/** Godot's vector types as plain components, for engine facts that import nothing. */

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

/** `Vector3::normalize` (`core/math/vector3.h:548-558`): a zero vector stays zero. */
export function normalizedVector3(x: number, y: number, z: number): [number, number, number] {
  const length = Math.hypot(x, y, z);
  return length === 0 ? [0, 0, 0] : [x / length, y / length, z / length];
}
