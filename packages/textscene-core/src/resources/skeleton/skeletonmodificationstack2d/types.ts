/**
 * The SkeletonModificationStack2D slice's types: a stack and the modifications it holds, as their
 * property bags read. A NodePath stays the raw literal the file wrote, since only the Skeleton2D
 * that runs the stack can resolve it.
 */

import type { Vector2 } from '../../../godot/math/vector.js';

/** A stack (`skeleton_modification_stack_2d.h:56-58`). */
export interface ModificationStack2D {
  enabled: boolean;
  /** How far each solved bone moves from its own pose to the solved one, 0 to 1. */
  strength: number;
  /** One entry for each slot of `modification_count`. Null for an empty slot. */
  modifications: (Modification2D | null)[];
}

/** `SkeletonModification2D` (`skeleton_modification_2d.h:50-52`). */
interface ModificationBase {
  enabled: boolean;
  /** 0 runs in the process frame, 1 in the physics frame. */
  executionMode: number;
}

/** The Bone2D a modification moves: the index it stores and the path that replaces it when it resolves. */
export interface BoneReference {
  index: number;
  /** The raw `NodePath(...)` literal, or undefined where the file wrote none or an empty one. */
  node: string | undefined;
}

/** The angle limit of a joint, in radians. */
export interface AngleConstraint {
  enabled: boolean;
  min: number;
  max: number;
  /** Whether the limit keeps the angle outside the range. */
  invert: boolean;
  /** Whether the limit reads the bone's own rotation, not its global one. */
  inLocalSpace: boolean;
}

export interface LookAtModification2D extends ModificationBase {
  type: 'SkeletonModification2DLookAt';
  bone: BoneReference;
  target: string | undefined;
  /** Radians added to the solved rotation. */
  additionalRotation: number;
  constraint: AngleConstraint;
}

export interface TwoBoneIKModification2D extends ModificationBase {
  type: 'SkeletonModification2DTwoBoneIK';
  target: string | undefined;
  targetMinimumDistance: number;
  /** 0 sets no maximum. */
  targetMaximumDistance: number;
  flipBendDirection: boolean;
  jointOne: BoneReference;
  jointTwo: BoneReference;
}

export interface CCDIKJoint2D {
  bone: BoneReference;
  /** Whether the joint turns to face the target, not to carry the tip to it. */
  rotateFromJoint: boolean;
  constraint: AngleConstraint;
}

export interface CCDIKModification2D extends ModificationBase {
  type: 'SkeletonModification2DCCDIK';
  target: string | undefined;
  tip: string | undefined;
  joints: CCDIKJoint2D[];
}

export interface FABRIKJoint2D {
  bone: BoneReference;
  magnetPosition: Vector2;
  useTargetRotation: boolean;
}

export interface FABRIKModification2D extends ModificationBase {
  type: 'SkeletonModification2DFABRIK';
  target: string | undefined;
  joints: FABRIKJoint2D[];
}

export interface StackHolderModification2D extends ModificationBase {
  type: 'SkeletonModification2DStackHolder';
  heldStack: ModificationStack2D | null;
}

/** A modification the previewer does not run: its solve needs simulated time or physics (ADR-0005). */
export interface RuntimeModification2D extends ModificationBase {
  type: 'SkeletonModification2DJiggle' | 'SkeletonModification2DPhysicalBones';
}

export type Modification2D =
  | LookAtModification2D
  | TwoBoneIKModification2D
  | CCDIKModification2D
  | FABRIKModification2D
  | StackHolderModification2D
  | RuntimeModification2D;
