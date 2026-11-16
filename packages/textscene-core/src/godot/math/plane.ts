/** Godot's `Plane` as plain components: a normal and the distance along it. The normal is not forced to unit length. */

import { vector3DotComponents, type Vector3 } from './vector.js';

export interface Plane {
  readonly normal: Readonly<Vector3>;
  readonly d: number;
}

/**
 * `Plane::distance_to` (plane.h:105) in `real_t` float: the signed distance of `point` along the normal.
 *
 * @canonical A Plane's signed distance to a point in float32
 */
export function planeDistanceTo({ normal, d }: Plane, point: Readonly<Vector3>): number {
  return Math.fround(vector3DotComponents(normal.x, normal.y, normal.z, point.x, point.y, point.z) - d);
}
