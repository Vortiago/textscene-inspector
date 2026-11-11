/**
 * The scene a SkeletonModificationStack2D solves in: the Skeleton2D, its bones and the nodes the
 * stack names. It holds no three.js object and no node of the Live scene tree, so the solve runs on
 * numbers alone.
 */

import type { Transform2DColumns } from '../../../../godot/math/transform2d.js';

/** One bone, at its index in the skeleton. */
export interface StackBone {
  /** The index of the parent bone, or -1 for a bone on the skeleton itself. */
  parent: number;
  /** `Bone2D::get_length()`. */
  length: number;
  /** `Bone2D::get_bone_angle()`, in radians. */
  boneAngle: number;
}

/** Where a node sits: `offset` below the bone `carrier`, or in canvas space for a carrier of -1. */
export interface StackPlacement {
  carrier: number;
  offset: Transform2DColumns;
}

/** A node a NodePath of the stack resolves to. The skeleton itself is never one. */
export interface StackNode {
  /** The index of the node as a bone of this skeleton, or -1 for any other node. */
  boneIndex: number;
  /**
   * `Bone2D::get_index_in_skeleton()` (`skeleton_2d.cpp:408-411`): the index of a Bone2D in the
   * skeleton it joins, which can be another one, or -1 where it joins none. Null for another type.
   */
  indexInSkeleton: number | null;
  /** Null for a node that is not a Node2D, which no modification can aim at. */
  placement: StackPlacement | null;
}

export interface StackScene {
  /** The global transform of the Skeleton2D. */
  skeletonGlobal: Transform2DColumns;
  bones: readonly StackBone[];
  /** Each NodePath literal the stack names that resolves from the skeleton, by that literal. */
  nodes: ReadonlyMap<string, StackNode>;
}
