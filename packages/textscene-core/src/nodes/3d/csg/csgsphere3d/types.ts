/** CSGSphere3D type definitions. */

import type { Node3DProperties } from '../../../base/node3d/types';

export interface CSGSphere3DProperties extends Node3DProperties {
  /** Sphere radius. Godot default is 0.5. */
  radius: number;
  /** Longitude divisions. Godot default 12. */
  radialSegments: number;
  /** Latitude divisions. Godot default 6. */
  rings: number;
  /** Smooth shading. Godot default **true** (csg_shape.cpp:1531). */
  smoothFaces: boolean;
  /** Reverse winding and negate normals (CSGPrimitive3D). Godot default false. */
  flipFaces: boolean;
  /** Material reference (SubResource/ExtResource); StandardMaterial3D in practice. */
  material?: string;
  /** CSG boolean operation: 0 UNION, 1 INTERSECTION, 2 SUBTRACTION. */
  operation?: number;
  /** `cast_shadow` — GeometryInstance3D state (`modules/csg/csg_shape.h:47`). */
  castShadow?: number;
}
