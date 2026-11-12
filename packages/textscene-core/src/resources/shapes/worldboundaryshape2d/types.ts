/** WorldBoundaryShape2D decoded data. */

import type { Vector2 } from '../../../godot/math/vector';

export interface WorldBoundaryShape2DProperties {
  /** The boundary normal, not necessarily unit length. `world_boundary_shape_2d.h:39`: `Vector2(0, -1)`. */
  normal: Vector2;
  /** The offset of the boundary along the normal, in pixels. `world_boundary_shape_2d.h:40`: 0. */
  distance: number;
}
