/** CollisionShape2D type definitions. */

import type { Node2DProperties } from '../../../base/node2d/types';

export interface CollisionShape2DProperties extends Node2DProperties {
  /** Reference to a 2D collision-shape resource (RectangleShape2D, CircleShape2D, …). */
  shape?: string;
  /** When true the shape is inactive in physics; still drawn as a gizmo. */
  disabled?: boolean;
}
