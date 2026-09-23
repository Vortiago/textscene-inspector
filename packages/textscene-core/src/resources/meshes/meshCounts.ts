/**
 * Godot's two integer-property patterns for PrimitiveMesh, which differ in what
 * an out-of-range value does. Both matter for rendering: below the floor three.js
 * draws a degenerate ring where Godot draws a coarse valid one, and a negative
 * subdivision reaches `BoxGeometry` as a negative segment count.
 */

import { warn } from '../../logger.js';
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

/**
 * Godot ERR_FAILs below `min` before the assignment (`:2153` rings < 1, `:2348`
 * rings < 3), so the property keeps its value, which at load time is its default.
 */
export function countAtLeast(
  raw: string | undefined,
  min: number,
  fallback: number,
  context: string
): number {
  const value = intOr(raw, fallback, context);
  if (value < min) {
    warn(`${context}: Godot rejects ${value} (below ${min}) — keeping the default ${fallback}`);
    return fallback;
  }
  return value;
}
