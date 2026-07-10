/** NavigationObstacle3D type definitions. */

import type { Node3DProperties } from '../../base/node3d/types';

export interface NavigationObstacle3DProperties extends Node3DProperties {
  /** Obstacle radius used for avoidance (cylinder shape). Godot default is 0.0. */
  radius?: number;
  /** Obstacle height used for avoidance. Godot default is 1.0. */
  height?: number;
  /** Whether avoidance is enabled for this obstacle. Godot default is true. */
  avoidance_enabled?: boolean;
  /** 32-bit layer bitmask other avoidance agents see this obstacle on. */
  avoidance_layers?: number;
  /** Whether the obstacle carves a hole into the navigation mesh. */
  affect_navigation_mesh?: boolean;
  /** Whether carving requires the obstacle to be static (vs dynamic avoidance only). */
  carve_navigation_mesh?: boolean;
  /** Whether avoidance uses full 3D (vs 2D/XZ-plane) computation. */
  use_3d_avoidance?: boolean;
}
