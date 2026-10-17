/** Godot 4.6.3's SkeletonModifier3D facts a scene's properties carry, and the XR modifiers' own. */

import { enumNamesByValue, pascalCaseLabel, relabelEnumNames } from '../classdb/enumNames.js';

/** The hint's `+X` and `-X` spelling of a `PLUS_X` or `MINUS_X` member. */
function signedAxisLabel(name: string): string {
  return name.replace('PLUS_', '+').replace('MINUS_', '-');
}

/** `SkeletonModifier3D::BoneAxis` (`skeleton_modifier_3d.h:45-50`). */
export const BoneAxis = {
  PLUS_X: 0,
  MINUS_X: 1,
  PLUS_Y: 2,
  MINUS_Y: 3,
  PLUS_Z: 4,
  MINUS_Z: 5,
} as const;

/** Each bone axis by the integer a `.tscn` stores, as `get_hint_bone_axis()` prints it (`:52`). */
export const BONE_AXIS_NAMES = relabelEnumNames(enumNamesByValue(BoneAxis), signedAxisLabel);

/**
 * `SkeletonModifier3D::BoneDirection` (`skeleton_modifier_3d.h:55-62`). A separate C++ enum from
 * {@link BoneAxis}: the two agree on 0-5, but either can be reordered alone.
 */
const BoneDirection = {
  PLUS_X: 0,
  MINUS_X: 1,
  PLUS_Y: 2,
  MINUS_Y: 3,
  PLUS_Z: 4,
  MINUS_Z: 5,
  FROM_PARENT: 6,
} as const;

/** Each bone direction by its integer, as `get_hint_bone_direction()` prints it (`:64`). */
export const BONE_DIRECTION_NAMES = relabelEnumNames(enumNamesByValue(BoneDirection), (name) =>
  name === 'FROM_PARENT' ? pascalCaseLabel(name) : signedAxisLabel(name)
);

/** `SkeletonModifier3D::SecondaryDirection` (`skeleton_modifier_3d.h:67-75`). */
export const SecondaryDirection = {
  NONE: 0,
  PLUS_X: 1,
  MINUS_X: 2,
  PLUS_Y: 3,
  MINUS_Y: 4,
  PLUS_Z: 5,
  MINUS_Z: 6,
  CUSTOM: 7,
} as const;

/** Each secondary direction by its integer, as `get_hint_secondary_direction()` prints it (`:77`). */
export const SECONDARY_DIRECTION_NAMES = relabelEnumNames(enumNamesByValue(SecondaryDirection), (name) =>
  name === 'NONE' || name === 'CUSTOM' ? pascalCaseLabel(name) : signedAxisLabel(name)
);

/** `SkeletonModifier3D::RotationAxis` (`skeleton_modifier_3d.h:80-85`). */
const RotationAxis = {
  X: 0,
  Y: 1,
  Z: 2,
  ALL: 3,
  CUSTOM: 4,
} as const;

/** Each rotation axis by its integer, as `get_hint_rotation_axis()` prints it (`:87`). */
export const ROTATION_AXIS_NAMES = relabelEnumNames(enumNamesByValue(RotationAxis), pascalCaseLabel);

/** `LookAtModifier3D::OriginFrom` (`look_at_modifier_3d.h:40-44`). */
const OriginFrom = {
  SELF: 0,
  SPECIFIC_BONE: 1,
  EXTERNAL_NODE: 2,
} as const;

/** Each look-at origin by its integer, as `look_at_modifier_3d.cpp:478` hints it. */
export const ORIGIN_FROM_NAMES = relabelEnumNames(enumNamesByValue(OriginFrom), pascalCaseLabel);

/** `BoneTwistDisperser3D::DisperseMode` (`bone_twist_disperser_3d.h:41-45`). */
const DisperseMode = {
  EVEN: 0,
  WEIGHTED: 1,
  CUSTOM: 2,
} as const;

/** Each disperse mode by its integer, as `bone_twist_disperser_3d.cpp:154` hints it. */
export const DISPERSE_MODE_NAMES = relabelEnumNames(enumNamesByValue(DisperseMode), pascalCaseLabel);

/** `SpringBoneSimulator3D::CenterFrom` (`spring_bone_simulator_3d.h:58-62`). */
const CenterFrom = {
  WORLD_ORIGIN: 0,
  NODE: 1,
  BONE: 2,
} as const;

/** Each spring bone centre by its integer, as `spring_bone_simulator_3d.cpp:300` hints it. */
export const CENTER_FROM_NAMES = relabelEnumNames(enumNamesByValue(CenterFrom), pascalCaseLabel);

/** `BoneConstraint3D::ReferenceType` (`bone_constraint_3d.h:39-42`). */
const ReferenceType = {
  BONE: 0,
  NODE: 1,
} as const;

/** Each reference type by its integer, spelled as its constant (`bone_constraint_3d.cpp:105`). */
export const REFERENCE_TYPE_NAMES = relabelEnumNames(
  enumNamesByValue(ReferenceType),
  (name) => `REFERENCE_TYPE_${name}`
);

/** `ConvertTransformModifier3D::TransformMode` (`convert_transform_modifier_3d.h:39-43`). */
export const TransformMode = {
  POSITION: 0,
  ROTATION: 1,
  SCALE: 2,
} as const;

/** Each transform mode by its integer, as the `transform_mode` hints print it. */
export const TRANSFORM_MODE_NAMES = relabelEnumNames(enumNamesByValue(TransformMode), pascalCaseLabel);

/**
 * `CopyTransformModifier3D::TransformFlag` and `RetargetModifier3D::TransformFlag`
 * (`copy_transform_modifier_3d.h:40-42`, `retarget_modifier_3d.h:41-43`). `TRANSFORM_FLAG_ALL` is
 * the OR of the three, not a fourth bit, so it is absent.
 */
const TransformFlag = {
  POSITION: 1,
  ROTATION: 2,
  SCALE: 4,
} as const;

/** Each copy-transform flag by its bit, as `copy_transform_modifier_3d.cpp:90` hints it. */
export const COPY_TRANSFORM_FLAG_NAMES = relabelEnumNames(enumNamesByValue(TransformFlag), pascalCaseLabel);

/** Each retarget flag by its bit, spelled as its constant (`retarget_modifier_3d.cpp:275`). */
export const RETARGET_TRANSFORM_FLAG_NAMES = relabelEnumNames(
  enumNamesByValue(TransformFlag),
  (name) => `TRANSFORM_FLAG_${name}`
);

/** `CopyTransformModifier3D::AxisFlag` (`copy_transform_modifier_3d.h:47-49`), `AXIS_FLAG_ALL` left out. */
const AxisFlag = {
  X: 1,
  Y: 2,
  Z: 4,
} as const;

/** Each axis flag by its bit, as `copy_transform_modifier_3d.cpp:91-92` hints it. */
export const AXIS_FLAG_NAMES = enumNamesByValue(AxisFlag);

/**
 * `XRBodyModifier3D::BodyUpdate` (`xr_body_modifier_3d.h:48-50`). No combined constant exists, so
 * every bit is a real flag, and their OR, 7, is the property default (`:83`).
 */
const BodyUpdate = {
  UPPER_BODY: 1,
  LOWER_BODY: 2,
  HANDS: 4,
} as const;

/** Each body update flag by its bit, spelled as its constant. */
export const BODY_UPDATE_NAMES = relabelEnumNames(
  enumNamesByValue(BodyUpdate),
  (name) => `BODY_UPDATE_${name}`
);

/**
 * `XRHandModifier3D::BoneUpdate` and `XRBodyModifier3D::BoneUpdate` (`xr_hand_modifier_3d.h:45-49`,
 * `xr_body_modifier_3d.h:53-57`). `BONE_UPDATE_MAX` (2) is the size marker, not a mode.
 */
const BoneUpdate = {
  FULL: 0,
  ROTATION_ONLY: 1,
} as const;

/** Each bone update mode by its integer, in the spelling of `BIND_ENUM_CONSTANT` minus its prefix. */
export const XR_HAND_MODIFIER_BONE_UPDATE_NAMES = enumNamesByValue(BoneUpdate);

/** Each bone update mode by its integer, spelled as `XRBodyModifier3D`'s constant. */
export const XR_BODY_MODIFIER_BONE_UPDATE_NAMES = relabelEnumNames(
  XR_HAND_MODIFIER_BONE_UPDATE_NAMES,
  (name) => `BONE_UPDATE_${name}`
);
