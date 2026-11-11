/**
 * The run of a SkeletonModificationStack2D on its Skeleton2D: the frames
 * `Skeleton2D::execute_modifications` (`skeleton_2d.cpp:769-815`) steps through, each one from the
 * pose the frame before left, until the pose repeats or the Harness frame comes.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  equalTransform2D,
  transform2DInterpolateWith,
  type Transform2DColumns,
} from '../../../../godot/math/transform2d.js';
import { SkeletonModification2DExecutionMode } from '../../../../godot/scene/skeletonModification2d.js';
import { HARNESS_CAPTURE } from '../../../../godot/scene/transformFlushes.js';
import type {
  Modification2D,
  ModificationStack2D,
} from '../../../../resources/skeleton/skeletonmodificationstack2d/types';
import { executeCCDIK } from './ccdIk';
import { executeFABRIK } from './fabrik';
import { executeLookAt } from './lookAt';
import type { StackFrame } from './stackFrame';
import { StackPose } from './stackPose';
import { outsideBonesOf, type StackScene } from './stackScene';
import { executeTwoBoneIK } from './twoBoneIk';

/** The pose a stack leaves on its skeleton. */
export interface SolvedPose {
  /** The local transform of each bone, by bone index, then of each bone `outsideBonesOf` lists. */
  locals: Transform2DColumns[];
  /** Whether a modification holds each bone, which the bone shows in the IK colour of its kite. */
  isOverridden: boolean[];
}

/** The local pose override of one bone (`skeleton_2d.h:149-151`). Every modification sets it persistent. */
interface PoseOverride {
  transform: Transform2DColumns;
  /** How far the bone moves to the override this frame. The apply step clears it. */
  amount: number;
}

/**
 * The pose `stack` gives the bones of `scene`, whose own local transforms are `cache`: the bone
 * transforms an AnimationPlayer or the scene file wrote, which each frame starts its override from.
 */
export function solveStack(
  scene: StackScene,
  cache: readonly Transform2DColumns[],
  stack: ModificationStack2D
): SolvedPose {
  const pose = new StackPose(scene.skeletonGlobal, scene.bones, cache, outsideBonesOf(scene));
  const overrides: (PoseOverride | undefined)[] = cache.map(() => undefined);
  const frames = new FramePoses({ locals: pose.locals(), isOverridden: cache.map(() => false) });
  for (let frame = 1; frame <= HARNESS_CAPTURE.frame; frame++) {
    // A drawn frame is a process frame.
    executeStack(stack, SkeletonModification2DExecutionMode.PROCESS, { pose, scene, overrides });
    const isOverridden = applyOverrides(pose, cache, overrides);
    const current: SolvedPose = { locals: pose.locals(), isOverridden };
    const repeated = frames.frameOf(current);
    if (repeated >= 0) {
      // A frame follows from the pose before it alone, so the poses since `repeated` come round
      // again, and the Harness frame holds the one at its own place in that round. A chain often
      // steps through several roundings of one answer.
      const period = frame - repeated;
      return frames.at(repeated + ((HARNESS_CAPTURE.frame - repeated) % period));
    }
    frames.push(current);
  }
  return frames.at(HARNESS_CAPTURE.frame);
}

function samePose(a: SolvedPose, b: SolvedPose): boolean {
  return (
    a.locals.every((local, bone) => equalTransform2D(local, b.locals[bone]!)) &&
    a.isOverridden.every((held, bone) => held === b.isOverridden[bone])
  );
}

/** A number that two equal poses share, so a search compares a pose with few others. */
function poseKey({ locals }: SolvedPose): number {
  let key = 0;
  for (const { a, b, tx, ty } of locals) key += a + b + tx + ty;
  return key;
}

/** The pose each frame of a solve left, by frame. Frame 0 holds the pose the solve starts from. */
class FramePoses {
  private readonly poses: SolvedPose[] = [];
  private readonly framesByKey = new Map<number, number[]>();

  constructor(start: SolvedPose) {
    this.push(start);
  }

  at(frame: number): SolvedPose {
    return this.poses[frame]!;
  }

  /** The frame that left `pose`, or -1 where none did. */
  frameOf(pose: SolvedPose): number {
    const frames = this.framesByKey.get(poseKey(pose)) ?? [];
    return frames.find((frame) => samePose(this.poses[frame]!, pose)) ?? -1;
  }

  push(pose: SolvedPose): void {
    const key = poseKey(pose);
    const frames = this.framesByKey.get(key);
    if (frames) frames.push(this.poses.length);
    else this.framesByKey.set(key, [this.poses.length]);
    this.poses.push(pose);
  }
}

interface StackRun {
  pose: StackPose;
  scene: StackScene;
  overrides: (PoseOverride | undefined)[];
}

/**
 * `SkeletonModificationStack2D::execute` (`skeleton_modification_stack_2d.cpp:89-111`): each
 * modification of `mode`, in order, in an enabled stack.
 */
function executeStack(stack: ModificationStack2D, mode: number, run: StackRun): void {
  if (!stack.enabled) return;
  const frame: StackFrame = {
    pose: run.pose,
    scene: run.scene,
    override(bone, transform) {
      if (run.pose.has(bone)) run.overrides[bone] = { transform, amount: stack.strength };
    },
  };
  for (const modification of stack.modifications) {
    if (modification?.executionMode === mode) executeModification(modification, frame, run);
  }
}

function executeModification(modification: Modification2D, frame: StackFrame, run: StackRun): void {
  // A holder runs its stack whether enabled or not, in its own mode
  // (`skeleton_modification_2d_stackholder.cpp:80-87`).
  if (modification.type === 'SkeletonModification2DStackHolder') {
    if (modification.heldStack) executeStack(modification.heldStack, modification.executionMode, run);
    return;
  }
  if (!modification.enabled) return;
  switch (modification.type) {
    case 'SkeletonModification2DLookAt':
      return executeLookAt(modification, frame);
    case 'SkeletonModification2DTwoBoneIK':
      return executeTwoBoneIK(modification, frame);
    case 'SkeletonModification2DCCDIK':
      return executeCCDIK(modification, frame);
    case 'SkeletonModification2DFABRIK':
      return executeFABRIK(modification, frame);
    case 'SkeletonModification2DJiggle':
    case 'SkeletonModification2DPhysicalBones':
    // Both need simulated time or physics, which the previewer does not run (ADR-0005).
  }
}

/**
 * The apply step of a process frame (`skeleton_2d.cpp:786-805`): a bone with an override moves
 * from its cache transform toward it, and every other bone returns to its cache transform.
 */
function applyOverrides(
  pose: StackPose,
  cache: readonly Transform2DColumns[],
  overrides: (PoseOverride | undefined)[]
): boolean[] {
  return cache.map((own, bone) => {
    const override = overrides[bone];
    overrides[bone] = undefined;
    const isHeld = override !== undefined && override.amount > 0;
    pose.setTransform(
      bone,
      isHeld ? transform2DInterpolateWith(own, override.transform, override.amount) : own
    );
    return isHeld;
  });
}
