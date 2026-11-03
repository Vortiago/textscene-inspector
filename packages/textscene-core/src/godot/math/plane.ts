/** Godot's `Plane` as plain components: a unit-length normal by convention and the distance along it. */

import type { Vector3 } from './vector.js';

export interface Plane {
  normal: Vector3;
  d: number;
}
