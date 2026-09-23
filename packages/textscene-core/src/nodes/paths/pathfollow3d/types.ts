/** PathFollow3D: positions its children along the parent Path3D's curve. */

import type { Node3DProperties } from '../../base/node3d/types';

/** Godot PathFollow3D.RotationMode. */
export const RotationMode = {
  NONE: 0,
  Y: 1,
  XY: 2,
  XYZ: 3,
  ORIENTED: 4,
} as const;

export interface PathFollow3DProperties extends Node3DProperties {
  /** Absolute distance along the curve, world units. Undefined when unset. */
  progress?: number;
  /** Fraction along the curve, 0..1. Godot drops it at load, so nothing positions from it. Undefined when unset. */
  progress_ratio?: number;
  /** Offset perpendicular to the curve along the oriented right axis (Godot default 0). */
  h_offset: number;
  /** Offset perpendicular to the curve along the oriented up axis (Godot default 0). */
  v_offset: number;
  /** How children are rotated to the curve (Godot default XYZ). */
  rotation_mode: number;
  /** Cubic (true) or linear interpolation between baked points (Godot default true). */
  cubic_interp: boolean;
  /** Wrap progress past the curve ends (Godot default true). */
  loop: boolean;
  /** Apply the curve's tilt (roll) in ORIENTED mode (Godot default true). */
  tilt_enabled: boolean;
  /** Treat the model's front as +Z instead of -Z (Godot default false). */
  use_model_front: boolean;
}
