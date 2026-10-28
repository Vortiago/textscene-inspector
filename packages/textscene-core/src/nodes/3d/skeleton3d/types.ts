/** Skeleton3D type definitions. */

import type { Node3DProperties } from '../../base/node3d/types';
import type { Bone } from './skeletonPose';

/** Skeleton3D node properties. */
export interface Skeleton3DProperties extends Node3DProperties {
  /** The bones the `bones/<i>/…` keys add, in the order `add_bone` added them. */
  bones: Bone[];
  /** Every bone takes its rest in place of its pose. */
  showRestOnly: boolean;
}
