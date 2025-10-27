/**
 * SpotLight3D type definitions
 */

import type { Node3DProperties } from '../node3d/types';

/**
 * SpotLight3D node properties
 *
 * Extends Node3D with cone-shaped light capabilities
 */
export interface SpotLight3DProperties extends Node3DProperties {
  /** Light color in Godot Color format */
  light_color: string;

  /** Light intensity/brightness */
  light_energy: number;

  /** Maximum distance the light reaches */
  spot_range: number;

  /** Cone angle in degrees */
  spot_angle: number;

  /** Enable/disable shadow casting */
  shadow_enabled: boolean;

  /** Shadow bias to prevent artifacts (optional) */
  shadow_bias?: number;

  /** Shadow quality filter (optional) */
  shadow_filter?: number;

  /** Penumbra percentage for soft edges (optional, 0-1) */
  penumbra?: number;
}
