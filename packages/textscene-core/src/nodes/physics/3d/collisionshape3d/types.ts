import type { Node3DProperties } from '../../../base/node3d/types';
import type { Color } from '../../../../utils/colorParser';

export interface CollisionShape3DProperties extends Node3DProperties {
  /** Reference to a collision-shape resource (BoxShape3D, ConvexPolygonShape3D, …). */
  shape?: string;
  /** When true the shape is inactive in physics; still drawn as a gizmo. */
  disabled?: boolean;
  /**
   * Wireframe colour for the editor overlay. Absent means the project default
   * (a translucent teal), not the `Color(0, 0, 0, 0)` placeholder the class
   * reference prints. See `physics/shared/debugColor.ts`.
   */
  debugColor?: Color;
}
