/**
 * CylinderMesh types for Godot cylinder meshes.
 */

export interface CylinderMeshProperties {
  top_radius: number;
  bottom_radius: number;
  height: number;
  radial_segments?: number;
  rings?: number;
  /** Godot `cap_top` / `cap_bottom`: whether each end-cap is drawn (default true). */
  capTop: boolean;
  capBottom: boolean;
}
