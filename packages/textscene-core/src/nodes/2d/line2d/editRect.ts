import { rect2Grow, type Rect2 } from '../../../godot/math/rect2.js';
import { pointBounds } from '../../../r3f/editRect/pointBounds.js';

/** line_2d.cpp:40-55. */
export function line2DEditRect(points: Float32Array, width: number): Rect2 {
  const bounds = pointBounds(points);
  return bounds ? rect2Grow(bounds, width) : { x: 0, y: 0, w: 0, h: 0 };
}
