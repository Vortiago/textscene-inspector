/** CSGMesh3D type definitions. */

import type { Node3DProperties } from '../../../base/node3d/types';

export interface CSGMesh3DProperties extends Node3DProperties {
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
  /** CSG boolean operation: 0 UNION, 1 INTERSECTION, 2 SUBTRACTION. */
  operation?: number;
  /** `cast_shadow`: GeometryInstance3D state (`modules/csg/csg_shape.h:47`). */
  castShadow?: number;
}
