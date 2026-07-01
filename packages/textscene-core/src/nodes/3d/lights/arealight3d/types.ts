/**
 * AreaLight3D type definitions
 */

import type { Node3DProperties } from '../../../base/node3d/types';
import type { BaseLightWithNormalBias } from '../shared/types';

/**
 * AreaLight3D node properties
 *
 * Extends Node3D with rectangular area light capabilities
 */
export interface AreaLight3DProperties extends Node3DProperties, BaseLightWithNormalBias {
  /** Penumbra/softness of the area light (optional, defaults to 1.0) */
  area_range?: number;

  /** Rectangular dimensions as "Vector2(w, h)" string (defaults to "Vector2(1, 1)") */
  area_size?: string;
}
