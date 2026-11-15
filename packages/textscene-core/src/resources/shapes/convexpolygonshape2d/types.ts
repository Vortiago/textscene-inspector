/** ConvexPolygonShape2D decoded data. */

import type { Vector2 } from '../../../godot/math/vector';

export interface ConvexPolygonShape2DProperties {
  /** The polygon corners in the order authored. Empty when absent or malformed. */
  points: Vector2[];
}
