/** CSGBox3D type definitions. */

import type { Node3DProperties } from '../../../base/node3d/types';

export interface CSGBox3DProperties extends Node3DProperties {
  /** Box dimensions. Godot default is Vector3(1, 1, 1), matching the parser. */
  size: { x: number; y: number; z: number };
  /** Reverse winding and negate normals (CSGPrimitive3D). Godot default false. */
  flipFaces: boolean;
  /** Material reference (SubResource/ExtResource); StandardMaterial3D in practice. */
  material?: string;
  /**
   * CSG boolean operation: 0 UNION (default), 1 INTERSECTION, 2 SUBTRACTION.
   * Parsed but NOT applied — the node renders as its base primitive (ADR-0004).
   */
  operation?: number;
}
