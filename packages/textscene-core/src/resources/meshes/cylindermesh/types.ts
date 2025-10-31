/**
 * CylinderMesh types for Godot cylinder meshes.
 */

export interface CylinderMeshProperties {
  top_radius: number;
  bottom_radius: number;
  height: number;
  radial_segments?: number;
  rings?: number;
}
