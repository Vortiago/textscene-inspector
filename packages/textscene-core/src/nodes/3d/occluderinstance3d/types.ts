/** OccluderInstance3D types. The node draws nothing, and its box is the `get_aabb` of its occluder. */

import type { Node3DProperties } from '../../base/node3d/types';

export interface OccluderInstance3DProperties extends Node3DProperties {
  /** The `occluder` reference to an Occluder3D, as written. */
  occluder?: string;
}
