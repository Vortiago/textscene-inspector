/** SegmentShape2D decoded data. */

import type { Vector2 } from '../../../godot/math/vector';

export interface SegmentShape2DProperties {
  /** The first end point. `segment_shape_2d.cpp:101`: the origin. */
  a: Vector2;
  /** The second end point. `segment_shape_2d.cpp:102`: `Vector2(0, 10)`. */
  b: Vector2;
}
