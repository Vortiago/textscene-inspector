/** CSGBox3D type definitions. */

import type { CSGShape3DProperties } from '../types';

export interface CSGBox3DProperties extends CSGShape3DProperties {
  /** Box dimensions. Godot default is Vector3(1, 1, 1), matching the parser. */
  size: { x: number; y: number; z: number };
  /** Reverse winding and negate normals (CSGPrimitive3D). Godot default false. */
  flipFaces: boolean;
  /** `material` path (SubResource/ExtResource); StandardMaterial3D in practice. */
  materialPath?: string;
}
