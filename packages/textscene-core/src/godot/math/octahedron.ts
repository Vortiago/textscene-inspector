import { clamp } from './math.js';
import { normalizedVector3 } from './vector.js';

const f = Math.fround;

const signOf = (value: number) => (value >= 0 ? 1 : -1);

/**
 * `Vector3::octahedron_encode` (`vector3.cpp:90`) in 32-bit floats: a direction as two lanes of 0 to 1.
 * @canonical Encode a direction as Godot's octahedron
 */
export function octahedronEncode(v: readonly number[]): [number, number] {
  const [x, y, z] = v.map(Math.abs) as [number, number, number];
  const sum = f(f(x + y) + z);
  const [nx, ny, nz] = v.map((c) => f(c / sum)) as [number, number, number];
  const folded =
    nz >= 0 ? [nx, ny] : [f(f(1 - Math.abs(ny)) * signOf(nx)), f(f(1 - Math.abs(nx)) * signOf(ny))];
  return folded.map((c) => f(f(c * 0.5) + 0.5)) as [number, number];
}

/** The y lane's least value, so a tangent's sign survives 16-bit storage (`vector3.cpp:116`). */
const TANGENT_BIAS = f(1 / 32767);

/** `Vector3::octahedron_tangent_encode` (`vector3.cpp:115`): the sign of the binormal in the y lane. */
export function octahedronTangentEncode(v: readonly number[], sign: number): [number, number] {
  const [x, y] = octahedronEncode(v);
  const half = f(f(Math.max(y, TANGENT_BIAS) * 0.5) + 0.5);
  return [x, sign >= 0 ? half : f(1 - half)];
}

/**
 * `Vector3::octahedron_decode` (`vector3.cpp:106`) in 32-bit floats: two lanes of 0 to 1 as a unit direction.
 * @canonical Decode Godot's octahedron as a direction
 */
export function octahedronDecode([octX, octY]: readonly number[]): [number, number, number] {
  const x = f(f(octX! * 2) - 1);
  const y = f(f(octY! * 2) - 1);
  const z = f(f(1 - Math.abs(x)) - Math.abs(y));
  const t = clamp(-z, 0, 1);
  return normalizedVector3(f(x + (x >= 0 ? -t : t)), f(y + (y >= 0 ? -t : t)), z);
}
