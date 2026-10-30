/**
 * One element of a flat packed array, as `packedArray.ts` parses it. Only the lazily loaded
 * particle simulations read elements, and esbuild puts a whole module in one chunk, so these live
 * apart from the parsers the webview's initial chunk carries.
 */
import type { Rgba } from '../../godot/math/math.js';
import type { Vector2, Vector3 } from '../../godot/math/vector.js';

/** The floats of one element of each array. */
const VECTOR2_FLOATS = 2;
const VECTOR3_FLOATS = 3;
const COLOR_FLOATS = 4;

/** @canonical Element count of a flat PackedVector2Array */
export function vector2Count(flat: Float32Array): number {
  return flat.length / VECTOR2_FLOATS;
}

/** @canonical Element of a flat PackedVector2Array */
export function vector2At(flat: Float32Array, index: number): Vector2 {
  const at = index * VECTOR2_FLOATS;
  return { x: flat[at]!, y: flat[at + 1]! };
}

/** @canonical Element count of a flat PackedVector3Array */
export function vector3Count(flat: Float32Array): number {
  return flat.length / VECTOR3_FLOATS;
}

/** @canonical Element of a flat PackedVector3Array */
export function vector3At(flat: Float32Array, index: number): Vector3 {
  const at = index * VECTOR3_FLOATS;
  return { x: flat[at]!, y: flat[at + 1]!, z: flat[at + 2]! };
}

/** @canonical Element count of a flat PackedColorArray */
export function colorCount(flat: Float32Array): number {
  return flat.length / COLOR_FLOATS;
}

/** @canonical Element of a flat PackedColorArray */
export function colorAt(flat: Float32Array, index: number): Rgba {
  const at = index * COLOR_FLOATS;
  return { r: flat[at]!, g: flat[at + 1]!, b: flat[at + 2]!, a: flat[at + 3]! };
}
