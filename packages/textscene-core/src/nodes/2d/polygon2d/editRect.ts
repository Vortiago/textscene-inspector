import type { Rect2 } from '../../../godot/math/rect2.js';
import type { Vector2 } from '../../../godot/math/vector.js';
import { pointBounds } from '../../../r3f/editRect/pointBounds.js';

/** polygon_2d.cpp:72-93. Null is no points. */
export function polygon2DEditRect(polygon: Float32Array, offset: Vector2): Rect2 | null {
  return pointBounds(polygon, offset);
}
