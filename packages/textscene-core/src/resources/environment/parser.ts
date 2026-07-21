/**
 * Environment parser - parses Environment resources from TSCN SubResource data
 */

import type { EnvironmentProperties } from './types';
import { BackgroundMode } from './types';
import { floatOr, intOr } from '../../parser/valueParsers';
import { colorOr } from '../../utils/colorParser';

export function parseEnvironment(
  properties: Record<string, string>
): EnvironmentProperties {
  return {
    // Background
    background_mode: intOr(properties.background_mode, 0, 'background_mode') as BackgroundMode,
    background_color: colorOr(properties.background_color, { r: 0, g: 0, b: 0, a: 1 }),
    background_energy_multiplier: floatOr(properties.background_energy_multiplier, 1.0, 'background_energy_multiplier'),
    sky: properties.sky,

    // Tonemapping (parsed so it isn't silently dropped; rendering deferred)
    tonemap_mode: intOr(properties.tonemap_mode, 0, 'tonemap_mode'),
    tonemap_white: floatOr(properties.tonemap_white, 1.0, 'tonemap_white'),
    tonemap_exposure: floatOr(properties.tonemap_exposure, 1.0, 'tonemap_exposure'),

    // Ambient lighting (Godot default ambient_light_color is BLACK / no ambient)
    ambient_light_source: intOr(properties.ambient_light_source, 0, 'ambient_light_source'),
    ambient_light_color: colorOr(properties.ambient_light_color, { r: 0, g: 0, b: 0, a: 1 }),
    ambient_light_energy: floatOr(properties.ambient_light_energy, 1.0, 'ambient_light_energy'),
    ambient_light_sky_contribution: floatOr(
      properties.ambient_light_sky_contribution,
      1.0,
      'ambient_light_sky_contribution'
    ),

    // Screen-space fog (Godot defaults: density 0.01, light_color ~bluish-grey)
    fog_enabled: properties.fog_enabled === 'true',
    fog_density: floatOr(properties.fog_density, 0.01, 'fog_density'),
    fog_light_color: colorOr(properties.fog_light_color, { r: 0.518, g: 0.553, b: 0.608, a: 1 }),
    fog_mode: intOr(properties.fog_mode, 0, 'fog_mode'),

    // Volumetric Fog
    volumetric_fog_enabled: properties.volumetric_fog_enabled === 'true',
    volumetric_fog_density: floatOr(properties.volumetric_fog_density, 0.05, 'volumetric_fog_density'),
    volumetric_fog_albedo: colorOr(properties.volumetric_fog_albedo, { r: 1, g: 1, b: 1, a: 1 }),
    volumetric_fog_emission: colorOr(properties.volumetric_fog_emission, { r: 0, g: 0, b: 0, a: 1 }),

    // Adjustments
    adjustment_enabled: properties.adjustment_enabled === 'true',
    adjustment_brightness: floatOr(properties.adjustment_brightness, 1.0, 'adjustment_brightness'),
    adjustment_contrast: floatOr(properties.adjustment_contrast, 1.0, 'adjustment_contrast'),
    adjustment_saturation: floatOr(properties.adjustment_saturation, 1.0, 'adjustment_saturation'),

    // SSR
    ssr_enabled: properties.ssr_enabled === 'true',
  };
}
