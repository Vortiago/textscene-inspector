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
  ambient: {
    color: Color;
    energy: number;
  };
  fog: {
    enabled: boolean;
    density: number;
    albedo: Color;
    emission: Color;
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
    ambient: {
      color: properties.ambient_light_color,
      energy: properties.ambient_light_energy,
    },
    fog: properties.volumetric_fog_enabled
      ? {
          enabled: true,
          density: properties.volumetric_fog_density,
          albedo: properties.volumetric_fog_albedo,
          emission: properties.volumetric_fog_emission,
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
