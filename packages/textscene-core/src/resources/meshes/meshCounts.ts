/**
 * The PrimitiveMesh counts Godot raises to a floor instead of refusing. A count whose
 * setter refuses reads through `settableIntOr`. The floor matters for rendering: below
 * it three.js draws a degenerate ring where Godot draws a coarse valid one, and a
 * negative subdivision reaches `BoxGeometry` as a negative segment count.
 */

import { intOr } from '../../parser/valueParsers.js';

/**
 * Godot raises anything below `floor` to it, without complaint:
 * `radial_segments = p_segments > 4 ? p_segments : 4` (`primitive_meshes.cpp:1347`
 * and siblings), and the subdivisions floor at 0 the same way (`:1004`).
 */
export function flooredCount(
  raw: string | undefined,
  floor: number,
  fallback: number,
  context: string
): number {
  return Math.max(floor, intOr(raw, fallback, context));
}
