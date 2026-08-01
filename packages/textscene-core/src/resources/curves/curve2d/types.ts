/**
 * Curve2D slice types.
 *
 * Coordinates stay in Godot 2D space (+Y down) throughout: the Path2D component
 * negates Y per vertex when it builds the gizmo geometry, and PathFollow2D
 * negates Y when it conjugates the follow transform — both matching the Node2D
 * `diag(1,-1,1)` convention.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Curve2DControlPoint {
  /** In-tangent handle, relative to `position`. */
  in: Vec2;
  /** Out-tangent handle, relative to `position`. */
  out: Vec2;
  position: Vec2;
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
