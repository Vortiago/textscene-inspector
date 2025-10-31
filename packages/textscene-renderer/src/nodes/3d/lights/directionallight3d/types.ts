/**
 * DirectionalLight3D type definitions
 */

import type { Node3DProperties } from '../../../base/node3d/types';

/**
 * DirectionalLight3D node properties
 *
 * Extends Node3D with parallel light (sunlight) capabilities
 */
export interface DirectionalLight3DProperties extends Node3DProperties {
  /** Light color in Godot Color format */
  light_color: string;

  /** Light intensity/brightness */
  light_energy: number;

  /** Enable/disable shadow casting */
  shadow_enabled: boolean;

  /** Shadow bias to prevent artifacts (optional) */
  shadow_bias?: number;

  /** Shadow normal bias (optional) */
  shadow_normal_bias?: number;

  /** Shadow quality filter (optional) */
  shadow_filter?: number;

  /** Directional shadow mode - cascade configuration (optional) */
  directional_shadow_mode?: number;

  /** Maximum shadow distance (optional) */
  directional_shadow_max_distance?: number;
}
