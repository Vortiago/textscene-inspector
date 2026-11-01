/** HingeJoint3D property surface. A key stays `undefined` when unauthored, so the consumer applies Godot's default. */

import { FULL_CIRCLE_LIMITS, type Joint3DProperties } from '../joint3d/types';

/** `params[PARAM_LIMIT_UPPER] = Math::PI * 0.5` in hinge_joint_3d.cpp:127, in radians. */
const DEFAULT_UPPER_LIMIT = Math.PI / 2;

/** `params[PARAM_LIMIT_LOWER] = -Math::PI * 0.5` in hinge_joint_3d.cpp:128, in radians. */
const DEFAULT_LOWER_LIMIT = -Math.PI / 2;

export interface HingeJoint3DProperties extends Joint3DProperties {
  /** Whether the angular limit applies. Godot default `false`. */
  'angular_limit/enable'?: boolean;
  /** The lower angular limit in radians, with no clamp. Godot default `-PI / 2`. */
  'angular_limit/lower'?: number;
  /** The upper angular limit in radians, with no clamp. Godot default `PI / 2`. */
  'angular_limit/upper'?: number;
}

/**
 * The limits the gizmo draws (`CreateHingeJointGizmo`, `:478-481`): the authored pair when the limit
 * is on, else lower 0 and upper -1, which draws the full circle.
 */
export function drawnAngularLimits(properties: HingeJoint3DProperties): { lower: number; upper: number } {
  if (properties['angular_limit/enable'] !== true) return FULL_CIRCLE_LIMITS;
  return {
    lower: properties['angular_limit/lower'] ?? DEFAULT_LOWER_LIMIT,
    upper: properties['angular_limit/upper'] ?? DEFAULT_UPPER_LIMIT,
  };
}
