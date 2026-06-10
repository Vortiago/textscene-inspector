/** CollisionShape3D type definitions. */

import type { Node3DProperties } from '../../../base/node3d/types';

export interface CollisionShape3DProperties extends Node3DProperties {
  /** Reference to a collision-shape resource (BoxShape3D, ConvexPolygonShape3D, …). */
  shape?: string;
  /** When true the shape is inactive in physics; still drawn as a gizmo. */
  disabled?: boolean;
}
