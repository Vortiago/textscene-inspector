/**
 * What a SkeletonModifier3D type hands the Skeleton3D pass: a reader from its node to the pose edit
 * it makes, and the view of the scene around the skeleton that the edit may read.
 */

import type { Transform3D } from '../../../godot/math/transform3d.js';
import type { TscnNode } from '../../../parser/types.js';
import type { PoseModifier } from './skeletonPose.js';

/** The scene a modifier reads besides the bones: node transforms in the global space of the scene. */
export interface ModifierWorld {
  /** The global transform of the Skeleton3D (`get_global_transform_interpolated`). */
  skeletonGlobal: Transform3D;
  /**
   * The global transform of the Node3D that `path` names from the modifier (`get_node_or_null`), or
   * null where the path names no node or a node that is not a Node3D.
   */
  nodeGlobal: (path: string) => Transform3D | null;
}

/**
 * The pose edit of a modifier node, or null where it makes none: a modifier that is not active, or
 * a type with no effect without a tracker.
 */
export type PoseModifierReader = (node: TscnNode, world: ModifierWorld) => PoseModifier | null;

/** The reader of a type with no effect on the pose: Godot gives it no edit to run. */
export const noPoseEdit: PoseModifierReader = () => null;
