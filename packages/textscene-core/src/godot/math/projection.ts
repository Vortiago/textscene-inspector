/** Perspective projection facts ported from `core/math/projection.h`. */
import { degToRadf, radToDeg } from './math.js';

const f = Math.fround;

/**
 * `Projection::get_fovy` (`projection.h:103-105`): float operands and answer, the steps in double.
 *
 * @canonical The vertical fov of a horizontal one
 */
export function getFovy(fovxDegrees: number, aspect: number): number {
  return f(radToDeg(Math.atan(f(aspect) * Math.tan(degToRadf(f(fovxDegrees)) * 0.5)) * 2));
}

/**
 * `Projection::set_depth_correction` (`projection.cpp:787-807`) with z reversed and remapped, by columns.
 *
 * @canonical Godot's depth correction of a projection
 */
export const depthCorrection = (isFlipped: boolean): number[] => [
  1,
  0,
  0,
  0,
  0,
  isFlipped ? -1 : 1,
  0,
  0,
  0,
  0,
  -0.5,
  0,
  0,
  0,
  0.5,
  1,
];
