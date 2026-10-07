/** CSGMesh3D type definitions. */

import type { CSGShape3DProperties } from '../types';

export interface CSGMesh3DProperties extends CSGShape3DProperties {
  /**
   * Raw `SubResource("…")` / `ExtResource("…")` reference to the Mesh. Godot's property hint
   * excludes PlaneMesh, PointMesh, QuadMesh and RibbonTrailMesh (csg_shape.cpp:1298), which are
   * not manifold and so cannot take part in a boolean.
   */
  mesh?: string;
  /**
   * `material` path. Unlike MeshInstance3D there is no per-surface override: Godot's CSGMesh3D
   * takes one material, which replaces the mesh's own (csg_shape.cpp:1167-1172).
   */
  materialPath?: string;
  /** Reverse winding and negate normals (CSGPrimitive3D). Godot default false. */
  flipFaces: boolean;
}
