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

  /** How dark the shadow is, 0-1 (optional). */
  shadow_opacity?: number;
}

/** The base plus normal bias, for the light types whose shadow reads it. */
export interface BaseLightWithNormalBias extends BaseLightProperties {
  /** Shadow normal bias (optional) */
  shadow_normal_bias?: number;
}

/** The base plus the distance fade, which only an omni or spot light draws (`light_3d.cpp:560`). */
export interface PositionalLightProperties extends BaseLightWithNormalBias {
  distance_fade_enabled?: boolean;

  /** Camera distance where the light starts to fade (optional). */
  distance_fade_begin?: number;

  /** Camera distance where the shadow starts to fade (optional). */
  distance_fade_shadow?: number;

  /** Distance over which the light and the shadow fade out (optional). */
  distance_fade_length?: number;
}
