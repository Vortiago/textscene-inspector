/** VoxelGI types. A VoxelGI lights the scene inside a box centred on its node, by a grid of cells. */

import type { Vector3 } from '../../../godot/math/vector';
import type { Node3DProperties } from '../../base/node3d/types';

export interface VoxelGIProperties extends Node3DProperties {
  /** The full size of the box in local units, as `set_size` leaves it. */
  size: Vector3;
  /** A `VoxelGI::Subdiv`: which of 64, 128, 256 and 512 cells divide the longest side. */
  subdiv: number;
}
