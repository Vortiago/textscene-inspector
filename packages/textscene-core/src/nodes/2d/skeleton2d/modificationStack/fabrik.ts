/**
 * `SkeletonModification2DFABRIK::_execute` (`skeleton_modification_2d_fabrik.cpp:101-290`): a chain
 * of joints reaches for the target, backwards from the target and forwards from the first joint.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  transform2DGetRotation,
  transform2DLookingAt,
  transform2DOrigin,
  transform2DSetRotation,
  transform2DSetScale,
  type Transform2DColumns,
} from '../../../../godot/math/transform2d.js';
import {
  vector2Add,
  vector2DistanceTo,
  vector2Lerp,
  vector2Scaled,
  vector2Sub,
  type Vector2,
} from '../../../../godot/math/vector.js';
import type { FABRIKModification2D } from '../../../../resources/skeleton/skeletonmodificationstack2d/types';
import { node2DGlobal, nodeAt, type StackFrame } from './stackFrame';
import type { StackNode } from './stackScene';

/** `chain_tolarance` (`skeleton_modification_2d_fabrik.h:67`): the chain stops this close to the target. */
const CHAIN_TOLERANCE = 0.01;
/** `chain_max_iterations` (`skeleton_modification_2d_fabrik.h:68`). */
const CHAIN_MAX_ITERATIONS = 10;

/** One run of the solve: the bones of the joints, their reaches and the transforms the passes move. */
interface Chain {
  modification: FABRIKModification2D;
  /** The bone each joint moves, by its index in the pose. */
  bones: number[];
  /** The bone of the skeleton that takes the transform of each joint: `bone_idx` of the joint. */
  slots: number[];
  /** The length of each joint's kite on the canvas. */
  reaches: number[];
  transforms: Transform2DColumns[];
  origin: Vector2;
  target: Transform2DColumns;
}

function withOrigin(transform: Transform2DColumns, origin: Vector2): Transform2DColumns {
  return { ...transform, tx: origin.x, ty: origin.y };
}

function direction(angle: number): Vector2 {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

interface ChainJoint {
  bone: number;
  slot: number;
}

/**
 * The bone a joint moves and the index its cache update stores (`:321-347`): any Bone2D its path
 * names, of this skeleton or not. Null for no node and for a node that is no Bone2D.
 */
function chainJoint(node: StackNode | undefined, frame: StackFrame): ChainJoint | null {
  if (!node) return null;
  if (node.boneIndex >= 0) return { bone: node.boneIndex, slot: node.boneIndex };
  if (!node.outsideBone) return null;
  return { bone: frame.pose.indexOfOutside(node.outsideBone), slot: node.indexInSkeleton ?? -1 };
}

/** The joints of the chain, or null where one of them names no Bone2D. */
function chainJoints(modification: FABRIKModification2D, frame: StackFrame): ChainJoint[] | null {
  const joints = modification.joints.map((joint) => chainJoint(nodeAt(frame, joint.bone.node), frame));
  return joints.every((joint) => joint !== null) ? joints : null;
}

export function executeFABRIK(modification: FABRIKModification2D, frame: StackFrame): void {
  const { pose } = frame;
  const target = node2DGlobal(frame, modification.target);
  if (!target || modification.joints.length <= 1) return;
  const joints = chainJoints(modification, frame);
  if (!joints) return;
  const bones = joints.map(({ bone }) => bone);

  const chain: Chain = {
    modification,
    bones,
    slots: joints.map(({ slot }) => slot),
    reaches: bones.map((bone) => {
      const scale = pose.globalScale(bone);
      return pose.bone(bone).length * Math.min(scale.x, scale.y);
    }),
    transforms: bones.map((bone) => pose.globalTransform(bone)),
    origin: pose.globalPosition(bones[0]!),
    target,
  };
  const last = bones.length - 1;
  const lastBone = bones[last]!;
  const usesTargetRotation = modification.joints[last]!.useTargetRotation;
  // The end of the last kite reads the bone itself, which no pass moves before the chain applies.
  const endAngle = usesTargetRotation ? transform2DGetRotation(target) : pose.globalRotation(lastBone);
  const end = vector2Add(
    pose.globalPosition(lastBone),
    vector2Scaled(direction(endAngle), chain.reaches[last]!)
  );
  if (vector2DistanceTo(end, transform2DOrigin(target)) > CHAIN_TOLERANCE) {
    for (let iteration = 0; iteration < CHAIN_MAX_ITERATIONS; iteration++) {
      chainBackwards(chain);
      chainForwards(chain);
    }
  }
  applyChain(chain, frame);
}

/** `chain_backwards` (`:219-262`): the last joint sits one kite short of the target, and each joint before it follows. */
function chainBackwards(chain: Chain): void {
  const { modification, transforms, reaches, target } = chain;
  const last = transforms.length - 1;
  const joint = modification.joints[last]!;
  const magnetised = withOrigin(
    transforms[last]!,
    vector2Add(transform2DOrigin(transforms[last]!), joint.magnetPosition)
  );
  const aimed = transform2DLookingAt(magnetised, transform2DOrigin(target));
  const angle = joint.useTargetRotation ? transform2DGetRotation(target) : transform2DGetRotation(aimed);
  transforms[last] = withOrigin(
    aimed,
    vector2Sub(transform2DOrigin(target), vector2Scaled(direction(angle), reaches[last]!))
  );

  for (let i = last - 1; i >= 0; i--) {
    const next = transform2DOrigin(transforms[i + 1]!);
    // The first joint has no magnet (`:245-247`).
    const magnet = i === 0 ? { x: 0, y: 0 } : modification.joints[i]!.magnetPosition;
    const current = vector2Add(transform2DOrigin(transforms[i]!), magnet);
    const weight = reaches[i]! / vector2DistanceTo(current, next);
    transforms[i] = withOrigin(transforms[i]!, vector2Lerp(next, current, weight));
  }
}

/**
 * `chain_forwards` (`:264-284`): the first joint returns to its place, and each joint after it sits
 * one kite along. Each joint takes the axes of the one before it, as the engine writes them.
 */
function chainForwards(chain: Chain): void {
  const { transforms, reaches } = chain;
  transforms[0] = withOrigin(transforms[0]!, chain.origin);
  for (let i = 0; i < transforms.length - 1; i++) {
    const current = transform2DOrigin(transforms[i]!);
    const next = transform2DOrigin(transforms[i + 1]!);
    const weight = reaches[i]! / vector2DistanceTo(next, current);
    transforms[i + 1] = withOrigin(transforms[i]!, vector2Lerp(current, next, weight));
  }
}

/** Each joint turns to face the next one, and the last one the target (`:187-216`). */
function applyChain(chain: Chain, frame: StackFrame): void {
  const { pose } = frame;
  const { modification, bones, slots, transforms, target } = chain;
  bones.forEach((bone, i) => {
    const isLast = i === bones.length - 1;
    let faced: Transform2DColumns;
    if (!isLast) faced = transform2DLookingAt(transforms[i]!, transform2DOrigin(transforms[i + 1]!));
    else if (modification.joints[i]!.useTargetRotation) {
      faced = transform2DSetRotation(transforms[i]!, transform2DGetRotation(target));
    } else faced = transform2DLookingAt(transforms[i]!, transform2DOrigin(target));
    const turned = transform2DSetRotation(faced, transform2DGetRotation(faced) - pose.bone(bone).boneAngle);
    pose.setGlobalTransform(bone, transform2DSetScale(turned, pose.globalScale(bone)));
    frame.override(slots[i]!, pose.transform(bone));
  });
}
