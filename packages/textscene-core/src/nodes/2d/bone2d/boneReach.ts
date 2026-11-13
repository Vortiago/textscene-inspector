/**
 * The length and the angle of a Bone2D: what its kite draws along where it has no Bone2D child, and
 * what a modification of its Skeleton2D aims with.
 */

import type { Vector2 } from '../../../godot/math/vector.js';
import type { Bone2DProperties } from './types';

export interface BoneReach {
  length: number;
  /** In radians. */
  angle: number;
}

/**
 * `Bone2D::calculate_length_and_rotation` (`skeleton_2d.cpp:431-449`) for a bone whose first Bone2D
 * child sits at `firstBoneChild` in its own space, or null where it has none. A bone that does not
 * calculate keeps its stored values. One with no such child keeps its length and takes its own
 * rotation as the angle.
 */
export function boneReachOf(props: Bone2DProperties, firstBoneChild: Vector2 | null): BoneReach {
  if (!props.auto_calculate_length_and_angle) return { length: props.length, angle: props.bone_angle };
  if (!firstBoneChild) return { length: props.length, angle: props.rotation };
  return {
    length: Math.hypot(firstBoneChild.x, firstBoneChild.y),
    angle: Math.atan2(firstBoneChild.y, firstBoneChild.x),
  };
}
