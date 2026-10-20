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

/** Float arithmetic: each `f(...)` rounds as a C++ `float` operation does. */
const f = Math.fround;

/** `Vector3::normalize` (`core/math/vector3.h:548-558`) in `real_t` float: a zero vector stays zero. */
export function normalizedVector3(x: number, y: number, z: number): [number, number, number] {
  const lengthSquared = f(f(f(x * x) + f(y * y)) + f(z * z));
  if (lengthSquared === 0) return [0, 0, 0];
  const length = f(Math.sqrt(lengthSquared));
  return [f(x / length), f(y / length), f(z / length)];
}
