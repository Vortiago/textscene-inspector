/**
 * The enums of Godot's physics bodies: CollisionObject, CharacterBody, RigidBody, SoftBody3D and
 * PhysicalBone3D (`scene/2d/physics/` and `scene/3d/physics/`). The 2D and 3D classes declare each
 * enum with the same members, so one enum serves both.
 */

import { enumNamesByValue } from '../classdb/enumNames.js';

/**
 * `CollisionObject2D::DisableMode` (`scene/2d/physics/collision_object_2d.h:44-48`) and
 * `CollisionObject3D::DisableMode` (`scene/3d/physics/collision_object_3d.h:43-47`).
 */
enum CollisionObjectDisableMode {
  REMOVE = 0,
  MAKE_STATIC = 1,
  KEEP_ACTIVE = 2,
}

export const COLLISION_OBJECT_DISABLE_MODE_NAMES = enumNamesByValue(CollisionObjectDisableMode);

/** `SoftBody3D::DisableMode` (`scene/3d/physics/soft_body_3d.h:70-73`): no MAKE_STATIC. */
enum SoftBodyDisableMode {
  REMOVE = 0,
  KEEP_ACTIVE = 1,
}

export const SOFT_BODY_DISABLE_MODE_NAMES = enumNamesByValue(SoftBodyDisableMode);

/**
 * `CharacterBody2D::MotionMode` (`scene/2d/physics/character_body_2d.h:40-43`) and the 3D twin
 * (`scene/3d/physics/character_body_3d.h:40-43`).
 */
enum MotionMode {
  GROUNDED = 0,
  FLOATING = 1,
}

export const MOTION_MODE_NAMES = enumNamesByValue(MotionMode);

/**
 * `CharacterBody2D::PlatformOnLeave` (`character_body_2d.h:44-48`) and the 3D twin
 * (`character_body_3d.h:44-48`).
 */
enum PlatformOnLeave {
  ADD_VELOCITY = 0,
  ADD_UPWARD_VELOCITY = 1,
  DO_NOTHING = 2,
}

export const PLATFORM_ON_LEAVE_NAMES = enumNamesByValue(PlatformOnLeave);

/** `RigidBody2D::FreezeMode` (`rigid_body_2d.h:40-43`) and `RigidBody3D::FreezeMode` (`rigid_body_3d.h:40-43`). */
enum FreezeMode {
  STATIC = 0,
  KINEMATIC = 1,
}

export const FREEZE_MODE_NAMES = enumNamesByValue(FreezeMode);

/** `RigidBody2D::CenterOfMassMode` (`rigid_body_2d.h:45-48`) and the 3D twin (`rigid_body_3d.h:45-48`). */
enum CenterOfMassMode {
  AUTO = 0,
  CUSTOM = 1,
}

export const CENTER_OF_MASS_MODE_NAMES = enumNamesByValue(CenterOfMassMode);

/**
 * `RigidBody2D::DampMode` (`rigid_body_2d.h:50-53`), `RigidBody3D::DampMode` (`rigid_body_3d.h:50-53`)
 * and `PhysicalBone3D::DampMode` (`physical_bone_3d.h:42-45`).
 */
enum DampMode {
  COMBINE = 0,
  REPLACE = 1,
}

export const DAMP_MODE_NAMES = enumNamesByValue(DampMode);

/** `RigidBody2D::CCDMode` (`rigid_body_2d.h:55-59`). RigidBody3D has no CCD mode enum. */
enum CcdMode {
  DISABLED = 0,
  CAST_RAY = 1,
  CAST_SHAPE = 2,
}

export const CCD_MODE_NAMES = enumNamesByValue(CcdMode);

/** `PhysicalBone3D::JointType` (`scene/3d/physics/physical_bone_3d.h:47-54`). */
enum PhysicalBoneJointType {
  NONE = 0,
  PIN = 1,
  CONE = 2,
  HINGE = 3,
  SLIDER = 4,
  '6DOF' = 5,
}

export const PHYSICAL_BONE_JOINT_TYPE_NAMES = enumNamesByValue(PhysicalBoneJointType);
