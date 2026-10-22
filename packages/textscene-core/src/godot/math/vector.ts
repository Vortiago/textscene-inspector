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
  const lengthSquared = vector3LengthSquared(x, y, z);
  if (lengthSquared === 0) return [0, 0, 0];
  const length = f(Math.sqrt(lengthSquared));
  return [f(x / length), f(y / length), f(z / length)];
}

type Components3 = readonly [number, number, number];

/** `Vector3::dot` (`core/math/vector3.h`) in `real_t` float, the products summed in order. */
export function vector3Dot(a: Components3, b: Components3): number {
  return f(f(f(a[0] * b[0]) + f(a[1] * b[1])) + f(a[2] * b[2]));
}

/** `Vector3::cross` (`core/math/vector3.h`) in `real_t` float. */
export function vector3Cross(a: Components3, b: Components3): [number, number, number] {
  return [
    f(f(a[1] * b[2]) - f(a[2] * b[1])),
    f(f(a[2] * b[0]) - f(a[0] * b[2])),
    f(f(a[0] * b[1]) - f(a[1] * b[0])),
  ];
}

/** `Vector3::maxf` (`core/math/vector3.h:105-107`): each component raised to at least `floor`. */
export function vector3Maxf({ x, y, z }: Vector3, floor: number): Vector3 {
  return { x: Math.max(x, floor), y: Math.max(y, floor), z: Math.max(z, floor) };
}

/** `Vector3::length` (`core/math/vector3.h:532-538`) in `real_t` float. */
export function vector3Length(x: number, y: number, z: number): number {
  return f(Math.sqrt(vector3LengthSquared(x, y, z)));
}

/** The squares summed in order, so a permuted vector can round to another length, as in Godot. */
function vector3LengthSquared(x: number, y: number, z: number): number {
  return f(f(f(x * x) + f(y * y)) + f(z * z));
}
