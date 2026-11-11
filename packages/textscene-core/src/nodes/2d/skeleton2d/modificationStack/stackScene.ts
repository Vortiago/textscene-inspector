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

/**
 * A Bone2D that is no bone of this skeleton. A FABRIK joint that names one moves it all the same,
 * and no frame returns it to the pose it had (`skeleton_modification_2d_fabrik.cpp:187-216`).
 */
export interface OutsideBone {
  /** The outside bone this one is a child of, or where the node above it sits. */
  parent: OutsideBone | StackPlacement;
  /** Its transform within its parent as the solve starts. */
  local: Transform2DColumns;
  /** `Bone2D::get_length()`. */
  length: number;
  /** `Bone2D::get_bone_angle()`, in radians. */
  boneAngle: number;
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
  /** The bone a Bone2D outside this skeleton is. Null for a bone of the skeleton and for another type. */
  outsideBone: OutsideBone | null;
}

export interface StackScene {
  /** The global transform of the Skeleton2D. */
  skeletonGlobal: Transform2DColumns;
  bones: readonly StackBone[];
  /** Each NodePath literal the stack names that resolves from the skeleton, by that literal. */
  nodes: ReadonlyMap<string, StackNode>;
}

/** Each outside bone the nodes of `scene` name, once, in the order the nodes name them. */
export function outsideBonesOf(scene: StackScene): OutsideBone[] {
  const bones = new Set<OutsideBone>();
  for (const { outsideBone } of scene.nodes.values()) if (outsideBone) bones.add(outsideBone);
  return [...bones];
}
