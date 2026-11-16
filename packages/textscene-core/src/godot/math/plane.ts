/** Godot's `Plane` as plain components: a normal and the distance along it. The normal is not forced to unit length. */

import { vector3Div, vector3DotComponents, vector3Length, type Vector3 } from './vector.js';

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

/**
 * `Plane::normalize` (plane.cpp:39) in `real_t` float: a zero normal gives the all-zero plane.
 *
 * @canonical A Plane scaled to a unit normal in float32
 */
export function normalizedPlane({ normal, d }: Plane): Plane {
  const length = vector3Length(normal.x, normal.y, normal.z);
  if (length === 0) return { normal: { x: 0, y: 0, z: 0 }, d: 0 };
  return { normal: vector3Div(normal, { x: length, y: length, z: length }), d: Math.fround(d / length) };
}
