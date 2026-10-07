/** CSGSphere3D type definitions. */

import type { CSGShape3DProperties } from '../types';

export interface CSGSphere3DProperties extends CSGShape3DProperties {
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
  /** `material` path (SubResource/ExtResource); StandardMaterial3D in practice. */
  materialPath?: string;
}
