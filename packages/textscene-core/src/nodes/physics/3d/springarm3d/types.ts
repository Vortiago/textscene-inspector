/**
 * SpringArm3D property surface. `spring_length` stays `undefined` when unauthored, so
 * the gizmo applies Godot's default. The cast keys (`shape`, `collision_mask`, `margin`)
 * are unread: the drive of the children is a gap (ADR-0045).
 */

import type { Node3DProperties } from '../../../base/node3d/types';

/** `_spring_length = 1.0` in scene/3d/physics/spring_arm_3d.h:41. */
export const DEFAULT_SPRING_LENGTH = 1;

export interface SpringArm3DProperties extends Node3DProperties {
  /** Length of the arm in metres, with no clamp. Godot default 1. */
  spring_length?: number;
}
