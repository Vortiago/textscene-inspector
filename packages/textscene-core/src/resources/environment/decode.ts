/**
 * Environment slice DECODE (ADR-0031): one `Environment` body's raw Godot-text
 * property strings in, `EnvironmentProperties` out.
 *
 * Pure and THREE-free. Every default is the one Godot's own `Environment`
 * constructor installs (`scene/resources/environment.h`), because a property a
 * scene omits is the common case rather than the exception.
 */

import type { EnvironmentProperties } from './types';
import { BackgroundMode, DEFAULT_AGX_CONTRAST } from './types';
import { floatOr, intOr } from '../../parser/valueParsers';
import { colorOr } from '../../utils/colorParser';
import { boolSlotValue } from '../../godot/index.js';

/** `Environment`'s constructor weights, finest mip first. */
const DEFAULT_GLOW_LEVELS = [0.0, 0.8, 0.4, 0.1, 0.0, 0.0, 0.0];

/** Godot's `RS::MAX_GLOW_LEVELS`, derived so an eighth weight cannot outrun it. */
export const GLOW_LEVEL_COUNT = DEFAULT_GLOW_LEVELS.length;

/**
 * `glow_levels/1`..`glow_levels/7` are seven independent properties, 1-based in
 * the file and 0-based in the weight array Godot hands the shader.
 */
function parseGlowLevels(properties: Record<string, string>): number[] {
  return DEFAULT_GLOW_LEVELS.map((fallback, index) => {
    const key = `glow_levels/${index + 1}`;
    return Math.max(0, floatOr(properties[key], fallback, key));
  });
}

export function decodeEnvironment(
  properties: Record<string, string>
): EnvironmentProperties {
  return {
    // Background
    background_mode: intOr(properties.background_mode, 0, 'background_mode') as BackgroundMode,
    background_color: colorOr(properties.background_color, { r: 0, g: 0, b: 0, a: 1 }),
    background_energy_multiplier: floatOr(properties.background_energy_multiplier, 1.0, 'background_energy_multiplier'),
    sky: properties.sky,

    // Tonemapping. AGX reads its OWN two properties rather than `tonemap_white`
    // (`Environment::_update_tonemap`), and their defaults are Blender's AgX
    // values — 16.29 and 1.25 (`environment.h`), not the other curve's 1.0.
    tonemap_mode: intOr(properties.tonemap_mode, 0, 'tonemap_mode'),
    tonemap_white: floatOr(properties.tonemap_white, 1.0, 'tonemap_white'),
    tonemap_agx_white: floatOr(properties.tonemap_agx_white, 16.29, 'tonemap_agx_white'),
    tonemap_agx_contrast: floatOr(
      properties.tonemap_agx_contrast,
      DEFAULT_AGX_CONTRAST,
      'tonemap_agx_contrast'
    ),
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
    fog_enabled: boolSlotValue(properties.fog_enabled) === true,
    fog_density: floatOr(properties.fog_density, 0.01, 'fog_density'),
    fog_light_color: colorOr(properties.fog_light_color, { r: 0.518, g: 0.553, b: 0.608, a: 1 }),
    fog_mode: intOr(properties.fog_mode, 0, 'fog_mode'),

    // Volumetric Fog
    volumetric_fog_enabled: boolSlotValue(properties.volumetric_fog_enabled) === true,
    volumetric_fog_density: floatOr(properties.volumetric_fog_density, 0.05, 'volumetric_fog_density'),
    volumetric_fog_albedo: colorOr(properties.volumetric_fog_albedo, { r: 1, g: 1, b: 1, a: 1 }),
    volumetric_fog_emission: colorOr(properties.volumetric_fog_emission, { r: 0, g: 0, b: 0, a: 1 }),

    // Glow / bloom (Godot Environment defaults)
    glow_enabled: boolSlotValue(properties.glow_enabled) === true,
    glow_levels: parseGlowLevels(properties),
    glow_normalized: boolSlotValue(properties.glow_normalized) === true,
    glow_intensity: floatOr(properties.glow_intensity, 0.3, 'glow_intensity'),
    glow_strength: floatOr(properties.glow_strength, 1.0, 'glow_strength'),
    glow_mix: floatOr(properties.glow_mix, 0.05, 'glow_mix'),
    glow_bloom: floatOr(properties.glow_bloom, 0.0, 'glow_bloom'),
    glow_blend_mode: intOr(properties.glow_blend_mode, 1, 'glow_blend_mode'),
    glow_hdr_threshold: floatOr(properties.glow_hdr_threshold, 1.0, 'glow_hdr_threshold'),
    glow_hdr_scale: floatOr(properties.glow_hdr_scale, 2.0, 'glow_hdr_scale'),
    glow_hdr_luminance_cap: floatOr(
      properties.glow_hdr_luminance_cap,
      12.0,
      'glow_hdr_luminance_cap'
    ),
    glow_map_strength: floatOr(properties.glow_map_strength, 0.8, 'glow_map_strength'),

    // Adjustments
    adjustment_enabled: boolSlotValue(properties.adjustment_enabled) === true,
    adjustment_brightness: floatOr(properties.adjustment_brightness, 1.0, 'adjustment_brightness'),
    adjustment_contrast: floatOr(properties.adjustment_contrast, 1.0, 'adjustment_contrast'),
    adjustment_saturation: floatOr(properties.adjustment_saturation, 1.0, 'adjustment_saturation'),

    // SSR
    ssr_enabled: boolSlotValue(properties.ssr_enabled) === true,
  };
}
