/** CSGSphere3D type definitions. */

import type { Node3DProperties } from '../../../base/node3d/types';

export interface CSGSphere3DProperties extends Node3DProperties {
  /** Sphere radius. Godot default is 0.5. */
  radius: number;
  /** Longitude divisions (→ three.js widthSegments). Godot default 12. */
  radialSegments: number;
  /** Latitude divisions (→ three.js heightSegments). Godot default 6. */
  rings: number;
  /** Material reference (SubResource/ExtResource); StandardMaterial3D in practice. */
  material?: string;
  /**
   * CSG boolean operation: 0 UNION (default), 1 INTERSECTION, 2 SUBTRACTION.
   * Parsed but NOT applied — the node renders as its base primitive (ADR-0004).
   */
  operation?: number;
}
