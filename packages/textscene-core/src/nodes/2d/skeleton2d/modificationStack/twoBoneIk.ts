/**
 * `SkeletonModification2DTwoBoneIK::_execute` (`skeleton_modification_2d_twoboneik.cpp:105-206`):
 * two bones bend so that the end of the second one reaches the target.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { acosClamped, sign } from '../../../../godot/math/math.js';
import { vector2Length, vector2Sub } from '../../../../godot/math/vector.js';
import type { TwoBoneIKModification2D } from '../../../../resources/skeleton/skeletonmodificationstack2d/types';
import { cachedBoneIndex, node2DGlobal, type StackFrame } from './stackFrame';
import type { StackPose } from './stackPose';

/** The length of the kite of `bone` on the canvas, at the smaller of its two global scales. */
function reach(pose: StackPose, bone: number): number {
  const scale = pose.globalScale(bone);
  return pose.bone(bone).length * Math.min(Math.abs(scale.x), Math.abs(scale.y));
}

/** The distance the solve aims for: the distance to the target, held inside the two limits. */
function aimedDistance(modification: TwoBoneIKModification2D, distance: number): number {
  const floored = Math.max(distance, modification.targetMinimumDistance);
  const { targetMaximumDistance: maximum } = modification;
  return maximum > 0 ? Math.min(floored, maximum) : floored;
}

export function executeTwoBoneIK(modification: TwoBoneIKModification2D, frame: StackFrame): void {
  const { pose } = frame;
  const target = node2DGlobal(frame, modification.target);
  if (!target) return;
  const one = cachedBoneIndex(frame, modification.jointOne);
  const two = cachedBoneIndex(frame, modification.jointTwo);
  if (!pose.has(one) || !pose.has(two)) return;

  const toTarget = vector2Sub({ x: target.tx, y: target.ty }, pose.globalPosition(one));
  const distance = aimedDistance(modification, vector2Length(toTarget));
  const aim = Math.atan2(toTarget.y, toTarget.x);
  const lengthOne = reach(pose, one);
  const lengthTwo = reach(pose, two);
  const angleOne = pose.bone(one).boneAngle;
  const angleTwo = pose.bone(two).boneAngle;
  // A first bone whose two global scales differ in sign is mirrored, and turns the other way.
  const scaleOne = pose.globalScale(one);
  const mirror = sign(scaleOne.x) === sign(scaleOne.y) ? 1 : -1;

  if (lengthOne + lengthTwo < distance) {
    pose.setGlobalRotation(one, aim - mirror * angleOne);
    pose.setGlobalRotation(two, aim - mirror * angleTwo);
  } else {
    const bend = modification.flipBendDirection ? -1 : 1;
    const shoulder =
      bend *
      acosClamped(
        (distance * distance + lengthOne * lengthOne - lengthTwo * lengthTwo) / (2 * distance * lengthOne)
      );
    const elbow =
      bend *
      acosClamped(
        (lengthTwo * lengthTwo + lengthOne * lengthOne - distance * distance) / (2 * lengthTwo * lengthOne)
      );
    // Only a NaN input gives NaN here, and the bones keep their rotation: a triangle that does
    // not close folds flat.
    if (!Number.isNaN(shoulder) && !Number.isNaN(elbow)) {
      pose.setGlobalRotation(one, aim - mirror * (shoulder + angleOne));
      pose.setRotation(two, -Math.PI - elbow - angleTwo + angleOne);
    }
  }
  frame.override(one, pose.transform(one));
  frame.override(two, pose.transform(two));
}
