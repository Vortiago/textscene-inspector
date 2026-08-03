/** RectangleShape2D decoded data. */

import type { Vector2 } from '../../../parser/vectors';

export interface RectangleShape2DProperties {
  /** Rectangle width/height in pixels. `rectangle_shape_2d.cpp:108`: `size = Size2(20, 20)`. */
  size: Vector2;
}
