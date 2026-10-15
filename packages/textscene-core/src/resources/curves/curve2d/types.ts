/**
 * Curve2D slice types, in Godot 2D space (+Y down). Path2D and PathFollow2D negate Y
 * themselves, by the Node2D `diag(1,-1,1)` convention.
 */

import type { Vector2 } from '../../../godot/vector';

export interface Curve2DControlPoint {
  /** In-tangent handle, relative to `position`. */
  in: Vector2;
  /** Out-tangent handle, relative to `position`. */
  out: Vector2;
  position: Vector2;
}

export interface Curve2DSample {
  x: number;
  y: number;
  /** Tangent direction at this distance, radians (Godot space, atan2(dy, dx)). */
  angle: number;
}

export interface Curve2DSampler {
  /** Tessellated polyline in Godot space, flat `[x0, y0, x1, y1, …]`. */
  points: number[];
  /** Total arc length (sum of polyline segment lengths). */
  length: number;
  /** Sample position + tangent angle at an absolute distance, clamped to [0, length]. */
  sampleAt(distance: number): Curve2DSample;
}
