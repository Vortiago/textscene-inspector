/**
 * LightOccluder2D-specific type definitions.
 */

import type { Node2DProperties } from '../../base/node2d/types';

export interface LightOccluder2DProperties extends Node2DProperties {
  /** "SubResource(...)" or "ExtResource(...)" reference to an OccluderPolygon2D. */
  occluder?: string;
  /** Bitmask of lights that cast shadows for this occluder. */
  light_mask: number;
  /** Whether SDF collision is enabled. */
  sdf_collision: boolean;
  /** Bitmask of lights affected by this occluder's SDF. */
  occluder_light_mask: number;
}
