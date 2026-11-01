/** SliderJoint3D property surface. A key stays `undefined` when unauthored, so the consumer applies Godot's default. */

import type { Joint3DProperties } from '../joint3d/types';

/** `params[PARAM_LINEAR_LIMIT_UPPER] = 1.0` in slider_joint_3d.cpp:125. */
export const DEFAULT_LINEAR_UPPER = 1;

/** `params[PARAM_LINEAR_LIMIT_LOWER] = -1.0` in slider_joint_3d.cpp:126. */
export const DEFAULT_LINEAR_LOWER = -1;

/** `params[PARAM_ANGULAR_LIMIT_UPPER]` and `params[PARAM_ANGULAR_LIMIT_LOWER]` in slider_joint_3d.cpp:136-137. */
export const DEFAULT_ANGULAR_LIMIT = 0;

export interface SliderJoint3DProperties extends Joint3DProperties {
  /** The upper end of the travel along X in metres. Godot default `1`. */
  'linear_limit/upper_distance'?: number;
  /** The lower end of the travel along X in metres. Godot default `-1`. */
  'linear_limit/lower_distance'?: number;
  /** The upper rotation limit around X in radians. Godot default `0`. */
  'angular_limit/upper_angle'?: number;
  /** The lower rotation limit around X in radians. Godot default `0`. */
  'angular_limit/lower_angle'?: number;
}
