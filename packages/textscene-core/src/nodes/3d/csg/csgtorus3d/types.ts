/** CSGTorus3D type definitions. */

import type { Node3DProperties } from '../../../base/node3d/types';

export interface CSGTorus3DProperties extends Node3DProperties {
  /** Radius of the hole. Godot default 0.5 (csg_shape.cpp:2142). */
  innerRadius: number;
  /** Outer radius of the ring. Godot default 1.0. */
  outerRadius: number;
  /**
   * Segments around the RING. Godot default 8. Note this is three's
   * `tubularSegments`, not its `radialSegments`; the two names swap.
   */
  sides: number;
  /** Segments around the TUBE cross-section. Godot default 6. */
  ringSides: number;
  /** Smooth shading. Godot default **true** here (contrast CSGPolygon3D, which is false). */
  smoothFaces: boolean;
  /** Reverse winding and negate normals (CSGPrimitive3D). Godot default false. */
  flipFaces: boolean;
  /** Material reference (SubResource/ExtResource); StandardMaterial3D in practice. */
  material?: string;
  /** CSG boolean operation: 0 UNION, 1 INTERSECTION, 2 SUBTRACTION. */
  operation?: number;
}
