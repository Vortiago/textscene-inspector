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

  /** Subtract light instead of adding it (darkening light) (optional) */
  light_negative?: boolean;

  /** Specular contribution multiplier 0-1 (optional) */
  light_specular?: number;

  /** Energy multiplier for this light inside volumetric fog (optional) */
  light_volumetric_fog_energy?: number;

  /** Enable/disable shadow casting */
  shadow_enabled: boolean;

  /** Shadow bias to prevent artifacts (optional) */
  shadow_bias?: number;

  /** Shadow edge softness (Godot 3D lights emit shadow_blur, not shadow_filter) (optional) */
  shadow_blur?: number;
}

/**
 * Extended base with normal bias (DirectionalLight3D, OmniLight3D).
 */
export interface BaseLightWithNormalBias extends BaseLightProperties {
  /** Shadow normal bias (optional) */
  shadow_normal_bias?: number;
}
