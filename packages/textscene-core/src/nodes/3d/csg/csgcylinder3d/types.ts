/** CSGCylinder3D type definitions. */

import type { Node3DProperties } from '../../../base/node3d/types';

export interface CSGCylinder3DProperties extends Node3DProperties {
  /** Cylinder radius. Godot default 0.5 (csg_shape.cpp:1917). */
  radius: number;
  /** Full cylinder height, half above and half below the origin. Godot default 2.0. */
  height: number;
  /** Radial segment count. Godot default 8. */
  sides: number;
  /** When true the top radius collapses to 0 (a cone). Godot default false. */
  cone: boolean;
  /**
   * Smooth shading on the WALLS. Godot default **true**; the caps are always flat
   * whatever this says (csg_shape.cpp:1795, :1810).
   */
  smoothFaces: boolean;
  /** Reverse winding and negate normals (CSGPrimitive3D). Godot default false. */
  flipFaces: boolean;
  /** Material reference (SubResource/ExtResource); StandardMaterial3D in practice. */
  material?: string;
  /** CSG boolean operation: 0 UNION, 1 INTERSECTION, 2 SUBTRACTION. */
  operation?: number;
}
