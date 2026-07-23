/**
 * Environment resource types - defines lighting, fog, and post-processing settings for scenes
 */

import type { Color } from '../materials/standardmaterial3d/types';

export enum BackgroundMode {
  BG_CLEAR_COLOR = 0,
  BG_COLOR = 1,
  BG_SKY = 2,
  BG_CANVAS = 3,
  BG_KEEP = 4,
  BG_CAMERA_FEED = 5,
}

export interface EnvironmentProperties {
  // Background
  background_mode: BackgroundMode;
  background_color: Color;
  background_energy_multiplier: number;

  /**
   * Sky SubResource reference (e.g. `SubResource("Sky_1")`). Present when
   * background_mode is BG_SKY. Parsed for inspection/validation; full sky/IBL
   * rendering is deferred (BG_SKY falls back to a flat background).
   */
  sky?: string;

  // Tonemapping (parsed for validation; tonemap rendering deferred like adjustments/SSR)
  /** 0 LINEAR, 1 REINHARDT, 2 FILMIC, 3 ACES, 4 AGX. */
  tonemap_mode: number;
  tonemap_white: number;
  tonemap_exposure: number;

  // Ambient lighting (scene-wide constant illumination)
  /** 0 BG (default), 1 DISABLED, 2 COLOR, 3 SKY — only 2/3 emit a flat ambient. */
  ambient_light_source: number;
  ambient_light_color: Color;
  ambient_light_energy: number;
  /**
   * How much of the ambient comes from the sky rather than
   * `ambient_light_color`, 0..1. Only read when the ambient source is a
   * cubemap; at the default 1.0 the flat colour contributes nothing.
   */
  ambient_light_sky_contribution: number;

  // Screen-space fog (maps to THREE.Fog/FogExp2)
  fog_enabled: boolean;
  fog_density: number;
  fog_light_color: Color;
  /** 0 EXPONENTIAL (default), 1 DEPTH. */
  fog_mode: number;

  // Volumetric Fog
  volumetric_fog_enabled: boolean;
  volumetric_fog_density: number;
  volumetric_fog_albedo: Color;
  volumetric_fog_emission: Color;

  // Glow / bloom (a compositor post-process — a bright-pass blur over HDR
  // luminance, added back before tonemapping). The editor preview environment
  // enables it, which is why emissive materials bloom in Godot's editor.
  glow_enabled: boolean;
  /** Overall additive contribution of the blurred glow buffer. Default 0.8. */
  glow_intensity: number;
  /** Softens/broadens the blur (higher = wider halo). Default 1.0. */
  glow_strength: number;
  /** Lifts even sub-threshold pixels into the glow buffer, 0..1. Default 0.0. */
  glow_bloom: number;
  /** HDR luminance above which a pixel contributes to glow. Default 1.0. */
  glow_hdr_threshold: number;
  /** 0 ADDITIVE, 1 SCREEN, 2 SOFTLIGHT (default), 3 REPLACE, 4 MIX. */
  glow_blend_mode: number;

  // Adjustments (parsed but warned in v1)
  adjustment_enabled: boolean;
  adjustment_brightness: number;
  adjustment_contrast: number;
  adjustment_saturation: number;

  // SSR (parsed but warned in v1)
  ssr_enabled: boolean;
}
