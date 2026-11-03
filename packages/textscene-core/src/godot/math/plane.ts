/** Godot's `Plane` as plain components: a normal and the distance along it. The normal is not forced to unit length. */

import type { Vector3 } from './vector.js';

export interface Plane {
  normal: Vector3;
  d: number;
}
