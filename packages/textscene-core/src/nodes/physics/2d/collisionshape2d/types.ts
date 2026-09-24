import type { Node2DProperties } from '../../../base/node2d/types';
import type { Color } from '../../../../utils/colorParser';

export interface CollisionShape2DProperties extends Node2DProperties {
  /** Reference to a 2D collision-shape resource (RectangleShape2D, CircleShape2D, …). */
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
