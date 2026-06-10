/**
 * Environment renderer - creates structured settings object for applying to THREE.js scene
 */

import type { EnvironmentProperties } from './types';
import type { Color } from '../materials/standardmaterial3d/types';

export interface EnvironmentSettings {
  background: {
    mode: number;
    color: Color;
    energyMultiplier: number;
  };
  /** Flat ambient — null when ambient_light_source is BG(0)/DISABLED(1). */
  ambient: {
    color: Color;
    energy: number;
  } | null;
  /** Screen-space fog (Godot fog_enabled). Volumetric fog has no THREE equivalent. */
  fog: {
    density: number;
    color: Color;
    mode: number;
  } | null;
  adjustments: {
    enabled: boolean;
    brightness: number;
    contrast: number;
    saturation: number;
  } | null;
  ssr: {
    enabled: boolean;
  } | null;
}

export function createEnvironmentSettings(
  properties: EnvironmentProperties
): EnvironmentSettings {
  return {
    background: {
      mode: properties.background_mode,
      color: properties.background_color,
      energyMultiplier: properties.background_energy_multiplier,
    },
    // Flat ambient only for COLOR(2)/SKY(3) sources; BG(0)/DISABLED(1) emit none.
    ambient:
      properties.ambient_light_source === 2 || properties.ambient_light_source === 3
        ? {
            color: properties.ambient_light_color,
            energy: properties.ambient_light_energy,
          }
        : null,
    // Scene fog is driven by Godot's screen-space fog; volumetric fog has no
    // THREE equivalent and is intentionally not applied (see PARITY-LIMITATIONS).
    fog: properties.fog_enabled
      ? {
          density: properties.fog_density,
          color: properties.fog_light_color,
          mode: properties.fog_mode,
        }
      : null,
    adjustments: properties.adjustment_enabled
      ? {
          enabled: true,
          brightness: properties.adjustment_brightness,
          contrast: properties.adjustment_contrast,
          saturation: properties.adjustment_saturation,
        }
      : null,
    ssr: properties.ssr_enabled
      ? {
          enabled: true,
        }
      : null,
  };
}
