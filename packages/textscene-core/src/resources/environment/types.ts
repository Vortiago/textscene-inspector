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

  // Ambient lighting (scene-wide constant illumination)
  /** 0 BG (default), 1 DISABLED, 2 COLOR, 3 SKY — only 2/3 emit a flat ambient. */
  ambient_light_source: number;
  ambient_light_color: Color;
  ambient_light_energy: number;

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

  // Adjustments (parsed but warned in v1)
  adjustment_enabled: boolean;
  adjustment_brightness: number;
  adjustment_contrast: number;
  adjustment_saturation: number;

  // SSR (parsed but warned in v1)
  ssr_enabled: boolean;
}
