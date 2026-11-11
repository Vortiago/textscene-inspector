/**
 * What one modification reads and writes while a stack executes: the pose, the nodes its NodePaths
 * resolve to, and the local pose override of each bone it solves.
 */

import type { Transform2DColumns } from '../../../../godot/math/transform2d.js';
import type { BoneReference } from '../../../../resources/skeleton/skeletonmodificationstack2d/types';
import type { StackPose } from './stackPose';
import type { StackNode, StackScene } from './stackScene';

export interface StackFrame {
  pose: StackPose;
  scene: StackScene;
  /**
   * `Skeleton2D::set_bone_local_pose_override` (`skeleton_2d.cpp:738-743`) at the strength of the
   * stack that holds the modification. A bone index out of range is refused.
   */
  override(bone: number, transform: Transform2DColumns): void;
}

/** The node `path` resolves to, or undefined for no path and for a path that names no node. */
export function nodeAt(frame: StackFrame, path: string | undefined): StackNode | undefined {
  return path === undefined ? undefined : frame.scene.nodes.get(path);
}

/**
 * The global transform of the Node2D `path` names, or null where it names none: a target cache
 * stays null for a missing node (`skeleton_modification_2d_lookat.cpp:266-278`), and a node of
 * another type fails `ObjectDB::get_instance<Node2D>`.
 */
export function node2DGlobal(frame: StackFrame, path: string | undefined): Transform2DColumns | null {
  const placement = nodeAt(frame, path)?.placement;
  return placement ? frame.pose.placed(placement) : null;
}

/**
 * The bone index of a joint whose cache update writes the index of the Bone2D its path names
 * (`skeleton_modification_2d_lookat.cpp:211-213`). The stored index stays for no path, for a path
 * that names no node and for a node that is no bone of the skeleton.
 */
export function cachedBoneIndex(frame: StackFrame, bone: BoneReference): number {
  const index = nodeAt(frame, bone.node)?.boneIndex ?? -1;
  return index >= 0 ? index : bone.index;
}
