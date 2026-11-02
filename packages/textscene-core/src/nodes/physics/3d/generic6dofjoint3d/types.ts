/** Generic6DOFJoint3D property surface. A key stays `undefined` when unauthored, so the consumer applies Godot's default. */

import type { SixDofAxisLimits, SixDofLimits } from '../joint3d/jointGizmoDrawer';
import type { Joint3DProperties } from '../joint3d/types';

type Axis = 'x' | 'y' | 'z';

/** The limit keys of one axis. Each limit is 0 and both limits are on by default (generic_6dof_joint_3d.cpp:316-344). */
type AxisProperties<A extends Axis> = {
  /** Whether the linear limit applies. Godot default `true`. */
  [K in `linear_limit_${A}/enabled`]?: boolean;
} & {
  /** The upper end of the travel along the axis in metres. Godot default `0`. */
  [K in `linear_limit_${A}/upper_distance` | `linear_limit_${A}/lower_distance`]?: number;
} & {
  /** Whether the angular limit applies. Godot default `true`. */
  [K in `angular_limit_${A}/enabled`]?: boolean;
} & {
  /** The upper and lower rotation limits around the axis in radians. Godot default `0`. */
  [K in `angular_limit_${A}/upper_angle` | `angular_limit_${A}/lower_angle`]?: number;
};

export type Generic6DOFJoint3DProperties = Joint3DProperties &
  AxisProperties<'x'> &
  AxisProperties<'y'> &
  AxisProperties<'z'>;

/** The limits of one axis the gizmo draws: each authored key, else Godot's default. */
function drawnAxisLimits(properties: Generic6DOFJoint3DProperties, axis: Axis): SixDofAxisLimits {
  return {
    linearEnabled: properties[`linear_limit_${axis}/enabled`] ?? true,
    linearLower: properties[`linear_limit_${axis}/lower_distance`] ?? 0,
    linearUpper: properties[`linear_limit_${axis}/upper_distance`] ?? 0,
    angularEnabled: properties[`angular_limit_${axis}/enabled`] ?? true,
    angularLower: properties[`angular_limit_${axis}/lower_angle`] ?? 0,
    angularUpper: properties[`angular_limit_${axis}/upper_angle`] ?? 0,
  };
}

export function drawnLimits(properties: Generic6DOFJoint3DProperties): SixDofLimits {
  return [
    drawnAxisLimits(properties, 'x'),
    drawnAxisLimits(properties, 'y'),
    drawnAxisLimits(properties, 'z'),
  ];
}

function sameAxis(a: SixDofAxisLimits, b: SixDofAxisLimits): boolean {
  return (
    a.linearEnabled === b.linearEnabled &&
    a.linearLower === b.linearLower &&
    a.linearUpper === b.linearUpper &&
    a.angularEnabled === b.angularEnabled &&
    a.angularLower === b.angularLower &&
    a.angularUpper === b.angularUpper
  );
}

/** Whether two limit sets hold the same values. */
export function sameLimits(a: SixDofLimits, b: SixDofLimits): boolean {
  return sameAxis(a[0], b[0]) && sameAxis(a[1], b[1]) && sameAxis(a[2], b[2]);
}
