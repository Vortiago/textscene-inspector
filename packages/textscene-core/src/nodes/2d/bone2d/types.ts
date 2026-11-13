/** The Bone2D property shape: a Node2D with the rest pose its Skeleton2D binds the skin at, and its gizmo keys. */

import type { Transform2DColumns } from '../../../godot/math/transform2d.js';
import type { Node2DProperties } from '../../base/node2d/types';

export interface Bone2DProperties extends Node2DProperties {
  /** The pose the skin is bound at, relative to the parent bone or the skeleton. */
  rest: Transform2DColumns;
  /** Whether the length and angle follow the first Bone2D child (`skeleton_2d.cpp:431-449`). */
  auto_calculate_length_and_angle: boolean;
  /** The kite length of a bone with no Bone2D child, in pixels. */
  length: number;
  /** The kite angle of a bone with no Bone2D child, in radians. The scene stores degrees. */
  bone_angle: number;
  /** `editor_settings/show_bone_gizmo`: whether the editor draws the kites (`skeleton_2d.cpp:205`). */
  show_bone_gizmo: boolean;
}
