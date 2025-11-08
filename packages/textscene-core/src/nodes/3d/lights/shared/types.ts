/**
 * Shared type definitions for light nodes.
 */

/**
 * Base light properties shared across all light types.
 */
export interface BaseLightProperties {
  /** Light color in Godot Color format */
  light_color: string;

  /** Light intensity/brightness */
  light_energy: number;

  /** Enable/disable shadow casting */
  shadow_enabled: boolean;

  /** Shadow bias to prevent artifacts (optional) */
  shadow_bias?: number;

  /** Shadow quality filter (optional) */
  shadow_filter?: number;
}

/**
 * Extended base with normal bias (DirectionalLight3D, OmniLight3D).
 */
export interface BaseLightWithNormalBias extends BaseLightProperties {
  /** Shadow normal bias (optional) */
  shadow_normal_bias?: number;
}
