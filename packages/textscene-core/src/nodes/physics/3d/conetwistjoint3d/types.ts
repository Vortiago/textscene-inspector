/** ConeTwistJoint3D property surface. A span stays `undefined` when unauthored, so the consumer applies Godot's default. */

import type { Joint3DProperties } from '../joint3d/types';

/** `params[PARAM_SWING_SPAN] = Math::PI * 0.25` in cone_twist_joint_3d.cpp:90, in radians. */
export const DEFAULT_SWING_SPAN = Math.PI / 4;

/** `params[PARAM_TWIST_SPAN] = Math::PI` in cone_twist_joint_3d.cpp:91, in radians. */
export const DEFAULT_TWIST_SPAN = Math.PI;

export interface ConeTwistJoint3DProperties extends Joint3DProperties {
  /** The swing cone's half-angle in radians, with no clamp. Godot default `PI / 4`. */
  swing_span?: number;
  /** The twist range in radians, with no clamp. Godot default `PI`. */
  twist_span?: number;
}
