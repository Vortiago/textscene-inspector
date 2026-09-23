/** LightOccluder2D types. */

import type { Node2DProperties } from '../../base/node2d/types';

export interface LightOccluder2DProperties extends Node2DProperties {
  /** "SubResource(...)" or "ExtResource(...)" reference to an OccluderPolygon2D. */
  occluder?: string;
  /**
   * The inherited CanvasItem light mask. Measured on Godot 4.6.3: it does not gate
   * shadow casting, only `occluder_light_mask` does.
   */
  light_mask: number;
  /** Whether SDF collision is enabled. */
  sdf_collision: boolean;
  /**
   * Which lights this occluder casts shadows for: it casts when
   * `occluder_light_mask & Light2D.shadow_item_cull_mask` is non-zero.
   */
  occluder_light_mask: number;
}
