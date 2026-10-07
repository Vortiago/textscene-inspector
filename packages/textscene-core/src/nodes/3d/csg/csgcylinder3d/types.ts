/** CSGCylinder3D type definitions. */

import type { CSGShape3DProperties } from '../types';

export interface CSGCylinder3DProperties extends CSGShape3DProperties {
  /** Cylinder radius. Godot default 0.5 (csg_shape.cpp:1917). */
  radius: number;
  /** Full cylinder height, half above and half below the origin. Godot default 2.0. */
  height: number;
  /** Radial segment count. Godot default 8. */
  sides: number;
  /** When true the top radius collapses to 0 (a cone). Godot default false. */
  cone: boolean;
  /**
   * Smooth shading on the walls. Godot default **true**. The caps are always flat whatever this
   * says (csg_shape.cpp:1795, :1810).
   */
  smoothFaces: boolean;
  /** Reverse winding and negate normals (CSGPrimitive3D). Godot default false. */
  flipFaces: boolean;
  /** `material` path (SubResource/ExtResource); StandardMaterial3D in practice. */
  materialPath?: string;
}
