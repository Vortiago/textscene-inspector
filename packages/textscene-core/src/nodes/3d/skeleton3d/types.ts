/** Skeleton3D type definitions. */

import type { Node3DProperties } from '../../base/node3d/types';
import type { OverridePhase } from '../../../core/NodeRegistry';
import type { BoneChange } from './readBones';
import type { Bone } from './skeletonPose';

/** Skeleton3D node properties. */
export type SkeletonLayer = OverridePhase & { changes: BoneChange[]; showRestOnly?: boolean };

export interface Skeleton3DProperties extends Node3DProperties {
  poseOverrides?: { base: Skeleton3DProperties; layers: readonly SkeletonLayer[] };
  /** The bones the `bones/<i>/…` keys add, in the order `add_bone` added them. */
  bones: Bone[];
  /** Every bone takes its rest in place of its pose. */
  showRestOnly: boolean;
  /** Multiplies a bone position that an animation writes (`animation_mixer.cpp:1020-1023`). */
  motionScale: number;
}
