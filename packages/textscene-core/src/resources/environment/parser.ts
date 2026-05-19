/**
 * Environment parser - parses Environment resources from TSCN SubResource data
 */

import type { EnvironmentProperties } from './types';
import { BackgroundMode } from './types';
import { parseColor } from '../materials/standardmaterial3d/parser';

export function parseEnvironment(
  properties: Record<string, string>
): EnvironmentProperties {
  return {
    // Background
    background_mode: (parseInt(properties.background_mode ?? '0', 10) as BackgroundMode),
    background_color: properties.background_color
      ? parseColor(properties.background_color)
      : { r: 0, g: 0, b: 0, a: 1 },
    background_energy_multiplier: parseFloat(properties.background_energy_multiplier ?? '1.0'),

    // Ambient lighting
    ambient_light_color: properties.ambient_light_color
      ? parseColor(properties.ambient_light_color)
      : { r: 1, g: 1, b: 1, a: 1 },
    ambient_light_energy: parseFloat(properties.ambient_light_energy ?? '1.0'),

    // Volumetric Fog
    volumetric_fog_enabled: properties.volumetric_fog_enabled === 'true',
    volumetric_fog_density: parseFloat(properties.volumetric_fog_density ?? '0.05'),
    volumetric_fog_albedo: properties.volumetric_fog_albedo
      ? parseColor(properties.volumetric_fog_albedo)
      : { r: 1, g: 1, b: 1, a: 1 },
    volumetric_fog_emission: properties.volumetric_fog_emission
      ? parseColor(properties.volumetric_fog_emission)
      : { r: 0, g: 0, b: 0, a: 1 },

    // Adjustments
    adjustment_enabled: properties.adjustment_enabled === 'true',
    adjustment_brightness: parseFloat(properties.adjustment_brightness ?? '1.0'),
    adjustment_contrast: parseFloat(properties.adjustment_contrast ?? '1.0'),
    adjustment_saturation: parseFloat(properties.adjustment_saturation ?? '1.0'),

    // SSR
    ssr_enabled: properties.ssr_enabled === 'true',
  };
}
