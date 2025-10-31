/**
 * OmniLight3D type definitions
 */

import type { Node3DProperties } from '../../../base/node3d/types';

/**
 * OmniLight3D node properties
 *
 * Extends Node3D with omnidirectional point light capabilities
 */
export interface OmniLight3DProperties extends Node3DProperties {
  /** Light color in Godot Color format */
  light_color: string;

  /** Light intensity/brightness */
  light_energy: number;

  /** Maximum distance the light reaches */
  omni_range: number;

  /** Light attenuation/decay (how light falls off with distance) */
  omni_attenuation: number;

  /** Enable/disable shadow casting */
  shadow_enabled: boolean;

  /** Shadow bias to prevent artifacts (optional) */
  shadow_bias?: number;

  /** Shadow normal bias (optional) */
  shadow_normal_bias?: number;

  /** Shadow quality filter (optional) */
  shadow_filter?: number;

  /** Omni shadow mode - DUAL_PARABOLOID or CUBE (optional) */
  omni_shadow_mode?: number;
}
