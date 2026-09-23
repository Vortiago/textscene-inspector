/** Curve3D slice types. Godot 3D space is right-handed Y-up, as three.js is, so coordinates map directly. */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Curve3DControlPoint {
  /** In-tangent handle, relative to `position`. */
  in: Vec3;
  /** Out-tangent handle, relative to `position`. */
  out: Vec3;
  position: Vec3;
}

export interface Curve3DSample {
  x: number;
  y: number;
  z: number;
  /** Unit tangent direction at this distance (zero vector for a degenerate curve). */
  tangent: Vec3;
}

export interface Curve3DSampler {
  /** Tessellated polyline, flat `[x0, y0, z0, x1, y1, z1, …]`. */
  points: number[];
  /** Total arc length (sum of polyline segment lengths). */
  length: number;
  /** Sample position + unit tangent at an absolute distance, clamped to [0, length]. */
  sampleAt(distance: number): Curve3DSample;
}
