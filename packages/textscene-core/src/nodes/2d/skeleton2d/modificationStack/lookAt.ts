/**
 * `SkeletonModification2DLookAt::_execute` (`skeleton_modification_2d_lookat.cpp:107-170`): one
 * bone turns so that its kite points at the target.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { LookAtModification2D } from '../../../../resources/skeleton/skeletonmodificationstack2d/types';
import { clampAngle } from './clampAngle';
import { cachedBoneIndex, node2DGlobal, nodeAt, type StackFrame } from './stackFrame';

export function executeLookAt(modification: LookAtModification2D, frame: StackFrame): void {
  const { pose } = frame;
  const target = node2DGlobal(frame, modification.target);
  if (!target) return;
  // A bone path that names no node leaves the cache null, and the modification returns each frame.
  if (modification.bone.node !== undefined && !nodeAt(frame, modification.bone.node)) return;
  const bone = cachedBoneIndex(frame, modification.bone);
  if (!pose.has(bone)) return;

  const turn =
    pose.angleTo(bone, { x: target.tx, y: target.ty }) -
    pose.bone(bone).boneAngle +
    modification.additionalRotation;
  const { constraint } = modification;
  if (!constraint.enabled) pose.rotate(bone, turn);
  else if (constraint.inLocalSpace)
    pose.setRotation(bone, clampAngle(turn + pose.rotation(bone), constraint));
  else pose.setGlobalRotation(bone, clampAngle(turn + pose.globalRotation(bone), constraint));
  frame.override(bone, pose.transform(bone));
}
