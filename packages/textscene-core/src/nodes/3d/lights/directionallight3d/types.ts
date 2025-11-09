/**
 * DirectionalLight3D type definitions
 */

import type { Node3DProperties } from '../../../base/node3d/types';
import type { BaseLightWithNormalBias } from '../shared/types';

/**
 * DirectionalLight3D node properties
 *
 * Extends Node3D with parallel light (sunlight) capabilities
 */
export interface DirectionalLight3DProperties extends Node3DProperties, BaseLightWithNormalBias {
  /** Directional shadow mode - cascade configuration (optional) */
  directional_shadow_mode?: number;

  /** Maximum shadow distance (optional) */
  directional_shadow_max_distance?: number;
}
