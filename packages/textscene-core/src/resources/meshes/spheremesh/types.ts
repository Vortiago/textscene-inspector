/**
 * SphereMesh types for Godot sphere meshes.
 */

export interface SphereMeshProperties {
  radius: number;
  height: number;
  radialSegments: number;
  rings: number;
  /** Godot `is_hemisphere`: render only the top dome (default false). */
  isHemisphere: boolean;
}
