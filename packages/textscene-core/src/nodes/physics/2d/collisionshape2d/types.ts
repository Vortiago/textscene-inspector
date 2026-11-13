import type { Node2DProperties } from '../../../base/node2d/types';
import type { Rgba } from '../../../../godot/math/math';

export interface CollisionShape2DProperties extends Node2DProperties {
  /** Reference to a 2D collision-shape resource (RectangleShape2D, CircleShape2D, …). */
  shape?: string;
  /** When true the shape is inactive in physics, and its gizmo draws grey. */
  disabled?: boolean;
  /** Draws the arrow that points the way a one-way shape lets a body through. */
  oneWayCollision?: boolean;
  /**
   * Wireframe colour for the editor overlay. Absent means the project default
   * (a translucent teal), not the `Color(0, 0, 0, 0)` placeholder the class
   * reference prints. See `physics/shared/debugColor.ts`.
   */
  debugColor?: Rgba;
}
