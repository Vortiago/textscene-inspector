/**
 * `SkeletonModification2DCCDIK::_execute` (`skeleton_modification_2d_ccdik.cpp:156-235`): each
 * joint in turn rotates to carry the tip node toward the target.
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
} from '../../../../godot/math/transform2d.js';
import { atan2Real } from '../../../../godot/math/realAtan2.js';
import { storedReal as f } from '../../../../godot/math/real.js';
import type { Vector2 } from '../../../../godot/math/vector.js';
import type {
  CCDIKJoint2D,
  CCDIKModification2D,
} from '../../../../resources/skeleton/skeletonmodificationstack2d/types';
import { clampAngle } from './clampAngle';
import { node2DGlobal, type StackFrame } from './stackFrame';

/** `from.angle_to_point(to)`: the angle of the line from `from` to `to`. */
function angleToPoint(from: Vector2, to: Vector2): number {
  return atan2Real(f(to.y - from.y), f(to.x - from.x));
}

export function executeCCDIK(modification: CCDIKModification2D, frame: StackFrame): void {
  for (const joint of modification.joints) {
    // The tip moves with each joint, so each joint reads both nodes again.
    const target = node2DGlobal(frame, modification.target);
    const tip = node2DGlobal(frame, modification.tip);
    if (!target || !tip) return;
    executeJoint(joint, transform2DOrigin(target), transform2DOrigin(tip), frame);
  }
}

function executeJoint(joint: CCDIKJoint2D, target: Vector2, tip: Vector2, frame: StackFrame): void {
  const { pose } = frame;
  // A joint reads only its stored index: no cache update runs for its path after setup.
  const bone = joint.bone.index;
  if (!pose.has(bone)) return;
  const global = pose.globalTransform(bone);
  const origin = transform2DOrigin(global);
  const rotation = joint.rotateFromJoint
    ? f(transform2DGetRotation(transform2DLookingAt(global, target)) - pose.bone(bone).boneAngle)
    : f(transform2DGetRotation(global) + f(angleToPoint(target, origin) - angleToPoint(tip, origin)));
  const { constraint } = joint;
  let turned = transform2DSetScale(transform2DSetRotation(global, rotation), pose.globalScale(bone));
  if (constraint.enabled && !constraint.inLocalSpace) {
    turned = transform2DSetRotation(turned, clampAngle(transform2DGetRotation(turned), constraint));
  }
  pose.setGlobalTransform(bone, turned);
  if (constraint.enabled && constraint.inLocalSpace) {
    const local = pose.transform(bone);
    pose.setTransform(
      bone,
      transform2DSetRotation(local, clampAngle(transform2DGetRotation(local), constraint))
    );
  }
  frame.override(bone, pose.transform(bone));
}
