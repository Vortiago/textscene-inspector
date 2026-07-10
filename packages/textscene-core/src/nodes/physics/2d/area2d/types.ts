/** Area2D type definitions. */

import type { Node2DProperties } from '../../../base/node2d/types';

export interface Area2DProperties extends Node2DProperties {
  /** Whether the area detects bodies/areas entering or exiting. */
  monitoring?: boolean;
  /** Whether other areas can detect this one entering or exiting. */
  monitorable?: boolean;
  /** 32-bit collision layer bitmask. */
  collision_layer?: number;
  /** 32-bit collision mask bitmask. */
  collision_mask?: number;
}
