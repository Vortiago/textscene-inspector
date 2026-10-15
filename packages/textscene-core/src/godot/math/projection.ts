/** Perspective projection facts ported from `core/math/projection.h`. */
import { degToRad, radToDeg } from './math.js';

/**
 * `Projection::get_fovy` (`core/math/projection.h:103-105`): the vertical fov, in degrees, of a
 * horizontal fov in degrees at `aspect`. `Camera3D` passes the reciprocal of the viewport aspect
 * under `KEEP_WIDTH` (`projection.cpp:254`).
 */
export function getFovy(fovxDegrees: number, aspect: number): number {
  return radToDeg(Math.atan(aspect * Math.tan(degToRad(fovxDegrees) * 0.5)) * 2);
}
