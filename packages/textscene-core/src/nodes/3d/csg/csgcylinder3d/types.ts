/** CSGCylinder3D type definitions. */

import type { Node3DProperties } from '../../../base/node3d/types';

export interface CSGCylinder3DProperties extends Node3DProperties {
  /** Cylinder radius. Godot default 1. */
  radius: number;
  /** Cylinder height. Godot default 1. */
  height: number;
  /** Radial segment count. Godot default 8. */
  sides: number;
  /** When true the top radius collapses to 0 (a cone). Godot default false. */
  cone: boolean;
  /** Material reference (SubResource/ExtResource); StandardMaterial3D in practice. */
  material?: string;
  /** CSG boolean operation (0 UNION default). Parsed but NOT applied (ADR-0004). */
  operation?: number;
}
