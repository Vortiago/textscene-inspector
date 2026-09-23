/** Light node data shared by every light type. */

/** Properties every light type has. */
export interface BaseLightProperties {
  /** Godot Color. */
  light_color: string;

  light_energy: number;

  /** Subtract light instead of adding it (optional). */
  light_negative?: boolean;

  /** Specular contribution multiplier 0-1 (optional) */
  light_specular?: number;

  /** Energy multiplier for this light inside volumetric fog (optional) */
  light_volumetric_fog_energy?: number;

  shadow_enabled: boolean;

  /** Shadow bias to prevent artifacts (optional) */
  shadow_bias?: number;

  /** Shadow edge softness: Godot 3D lights write shadow_blur, not shadow_filter (optional). */
  shadow_blur?: number;
}

/** The base plus normal bias, for DirectionalLight3D and OmniLight3D. */
export interface BaseLightWithNormalBias extends BaseLightProperties {
  /** Shadow normal bias (optional) */
  shadow_normal_bias?: number;
}
