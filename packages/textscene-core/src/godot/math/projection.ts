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
