/** Godot's vector types as plain components, for engine facts that import nothing. */

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
