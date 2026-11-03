/** WorldBoundaryShape3D decoded data. */

import type { Plane } from '../../../godot/math/plane';

export interface WorldBoundaryShape3DProperties {
  /** The boundary plane. `world_boundary_shape_3d.cpp:136` constructs with `Plane(0, 1, 0, 0)`. */
  plane: Plane;
}
