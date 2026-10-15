/** BoxShape3D decoded data. */

import type { Vector3 } from '../../../godot/math/vector';

export interface BoxShape3DProperties {
  /** Box extents. `box_shape_3d.cpp:119` constructs with `Vector3(1, 1, 1)`. */
  size: Vector3;
}
