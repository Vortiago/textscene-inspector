/**
 * The pose edit of a CopyTransformModifier3D: each `settings/<i>/` entry copies the pose of a
 * reference bone, or the transform of a reference node, onto an apply bone. It ports
 * `BoneConstraint3D::_process_modification` (`bone_constraint_3d.cpp:300-332`) and
 * `CopyTransformModifier3D::_process_copy` (`copy_transform_modifier_3d.cpp:398-488`).
 */

import {
  normalizedQuaternion,
  quaternionFromAxisAngle,
  quaternionInverse,
  quaternionMultiply,
  type Quaternion,
} from '../../../../godot/math/quaternion.js';
import {
  affineInverseTransform3D,
  decomposeTransform3D,
  interpolateTransform3D,
  multiplyTransform3D,
  transform3DFromQuaternionScale,
  type Transform3D,
} from '../../../../godot/math/transform3d.js';
import { storedReal as f } from '../../../../godot/math/real.js';
import {
  VECTOR3_AXES,
  vector3Add,
  vector3Div,
  vector3Mul,
  vector3Sub,
  type Vector3,
} from '../../../../godot/math/vector.js';
import type { ModifierWorld, PoseModifierReader } from '../../skeleton3d/poseModifier.js';
import type { BonePoses } from '../../skeleton3d/skeletonPose.js';
import { rollAngle } from '../shared/rollAngle.js';
import type { CopyTransformModifier3DProperties, CopyTransformSetting } from './types.js';

/** `CopyTransformModifier3D::TransformFlag` (`copy_transform_modifier_3d.h:40-42`). */
const COPY_POSITION = 1;
const COPY_ROTATION = 2;
const COPY_SCALE = 4;

/** `CopyTransformModifier3D::AxisFlag` (`copy_transform_modifier_3d.h:47-49`). */
const AXIS_X = 1;
const AXIS_Y = 2;
const AXIS_Z = 4;

/** `BoneConstraint3D::ReferenceType` (`bone_constraint_3d.h:39-42`). */
const REFERENCE_NODE = 1;

/** The three world axes, indexed as `1 << i` selects an `AxisFlag` bit. */
const AXIS_VECTORS: readonly Vector3[] = [
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
];

/** The edit of a CopyTransformModifier3D node on a pose, or null where it is not active. */
export const readCopyTransformModifier: PoseModifierReader = (node, world) => {
  const { active, influence, settings } = node.properties as CopyTransformModifier3DProperties;
  if (!active) return null;
  return {
    influence,
    edit: (poses) => {
      for (const setting of settings) editWithSetting(poses, world, setting);
    },
  };
};

/** `BoneConstraint3D::_process_modification` for one setting: a skip for each missing part. */
function editWithSetting(poses: BonePoses, world: ModifierWorld, setting: CopyTransformSetting): void {
  if (!(setting.amount > 0)) return;
  const applyBone = boneOf(poses, setting.applyBoneName, setting.applyBone);
  if (applyBone < 0) return;
  if (setting.referenceType === REFERENCE_NODE) {
    const destination = referenceNodeTransform(poses, world, setting, applyBone);
    if (destination) copyOnto(poses, setting, applyBone, destination);
    return;
  }
  const referenceBone = boneOf(poses, setting.referenceBoneName, setting.referenceBone);
  if (referenceBone >= 0)
    copyOnto(poses, setting, applyBone, boneReferenceTransform(poses, setting, referenceBone));
}

/**
 * The bone a setting names: a bone name wins over a bone index (`_validate_bone_names`,
 * `bone_constraint_3d.cpp:284-298`), and an index outside the table names none (`:166-170`).
 */
function boneOf(poses: BonePoses, name: string, index: number): number {
  if (name !== '') return poses.findBone(name);
  return index >= 0 && index < poses.boneCount ? index : -1;
}

/** `_process_constraint_by_bone` (`copy_transform_modifier_3d.cpp:370-379`). */
function boneReferenceTransform(poses: BonePoses, setting: CopyTransformSetting, bone: number): Transform3D {
  const pose = poses.pose(bone);
  if (!setting.relative) return pose;
  const { rotation, scale } = decomposeTransform3D(pose);
  const rest = poses.rest(bone);
  const restParts = decomposeTransform3D(rest);
  return transform3DFromQuaternionScale(
    quaternionMultiply(quaternionInverse(restParts.rotation), rotation),
    vector3Div(scale, restParts.scale),
    vector3Sub(pose.origin, rest.origin)
  );
}

/** `_process_constraint_by_node` (`:381-396`): the node in the space of the parent of the apply bone. */
function referenceNodeTransform(
  poses: BonePoses,
  world: ModifierWorld,
  setting: CopyTransformSetting,
  applyBone: number
): Transform3D | null {
  if (setting.referenceNode === '') return null;
  const node = world.nodeGlobal(setting.referenceNode);
  if (!node) return null;
  const parent = poses.parentOf(applyBone);
  const skeleton =
    parent >= 0 ? multiplyTransform3D(world.skeletonGlobal, poses.globalPose(parent)) : world.skeletonGlobal;
  return multiplyTransform3D(affineInverseTransform3D(skeleton), node);
}

/** `_process_copy` (`:398-488`): mask, invert, place and blend `reference`, then write the flagged parts. */
function copyOnto(
  poses: BonePoses,
  setting: CopyTransformSetting,
  applyBone: number,
  reference: Transform3D
): void {
  const decomposed = decomposeTransform3D(reference);
  const position = { ...reference.origin };
  const scale = { ...decomposed.scale };
  for (let i = 0; i < 3; i++) {
    const axis = VECTOR3_AXES[i]!;
    if (!(setting.axisFlags & (1 << i))) {
      position[axis] = 0;
      scale[axis] = 1;
    }
  }
  let rotation = maskedRotation(decomposed.rotation, setting.axisFlags);
  for (let i = 0; i < 3; i++) {
    const axis = VECTOR3_AXES[i]!;
    if (setting.axisFlags & setting.invertFlags & (1 << i)) {
      position[axis] = f(position[axis] * -1);
      rotation = { ...rotation, [axis]: f(rotation[axis] * -1) };
      scale[axis] = f(1 / scale[axis]);
    }
  }
  rotation = normalizedQuaternion(rotation);

  const placed = placedOnApplyBone(poses, setting, applyBone, { position, rotation, scale });
  const blended = interpolateTransform3D(poses.pose(applyBone), placed, setting.amount);
  const { rotation: blendedRotation, scale: blendedScale } = decomposeTransform3D(blended);
  if (setting.copyFlags & COPY_POSITION) poses.setPosePosition(applyBone, blended.origin);
  if (setting.copyFlags & COPY_ROTATION) poses.setPoseRotation(applyBone, blendedRotation);
  if (setting.copyFlags & COPY_SCALE) poses.setPoseScale(applyBone, blendedScale);
}

/** The rotation kept by the enabled axes (`copy_transform_modifier_3d.cpp:411-451`). */
function maskedRotation(rotation: Quaternion, axisFlags: number): Quaternion {
  switch (axisFlags) {
    case 0:
      return { x: 0, y: 0, z: 0, w: 1 };
    case AXIS_X:
    case AXIS_Y:
    case AXIS_Z: {
      const axis = AXIS_VECTORS[Math.log2(axisFlags)]!;
      return quaternionFromAxisAngle(axis, rollAngle(rotation, axis));
    }
    case AXIS_X | AXIS_Y:
      return withoutRoll(rotation, AXIS_VECTORS[2]!);
    case AXIS_Y | AXIS_Z:
      return withoutRoll(rotation, AXIS_VECTORS[0]!);
    case AXIS_Z | AXIS_X:
      return withoutRoll(rotation, AXIS_VECTORS[1]!);
    default:
      return rotation;
  }
}

/** `rotation * Quaternion(axis, roll).inverse()`: the turn with its roll about `axis` taken off. */
function withoutRoll(rotation: Quaternion, axis: Vector3): Quaternion {
  return quaternionMultiply(
    rotation,
    quaternionInverse(quaternionFromAxisAngle(axis, rollAngle(rotation, axis)))
  );
}

interface MaskedParts {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
}

/** The masked parts placed over the pose, the rest or nothing of the apply bone (`:476-488`). */
function placedOnApplyBone(
  poses: BonePoses,
  setting: CopyTransformSetting,
  applyBone: number,
  { position, rotation, scale }: MaskedParts
): Transform3D {
  // A reference node is never relative (`is_relative`, `copy_transform_modifier_3d.h:61-66`).
  const isRelative = setting.relative && setting.referenceType !== REFERENCE_NODE;
  const base = setting.additive
    ? {
        position: poses.posePosition(applyBone),
        rotation: poses.poseRotation(applyBone),
        scale: poses.poseScale(applyBone),
      }
    : isRelative
      ? restPartsOf(poses.rest(applyBone))
      : undefined;
  if (!base) return transform3DFromQuaternionScale(rotation, scale, position);
  return transform3DFromQuaternionScale(
    quaternionMultiply(base.rotation, rotation),
    vector3Mul(base.scale, scale),
    vector3Add(base.position, position)
  );
}

function restPartsOf(rest: Transform3D): MaskedParts {
  return { position: rest.origin, ...decomposeTransform3D(rest) };
}
