/**
 * Environment slice decode (ADR-0031): one `Environment` body's property strings in,
 * `EnvironmentProperties` out. THREE-free. Every default is the one Godot's
 * `Environment` constructor installs (`scene/resources/environment.h`).
 */

import type { EnvironmentProperties } from './types';
import { BackgroundMode, DEFAULT_AGX_CONTRAST } from './types';
import { enumOr, floatOr, intOr, parseOptionalFloat, vec3Or } from '../../parser/valueParsers';
import { colorOr } from '../../utils/colorParser';
import { boolSlotValue } from '../../godot/index.js';
import { volumetricFogDetailSpread } from '../../godot/volumetricFog.js';
import { FogMode, depthFogDensityDefault, depthFogRange } from '../../godot/depthFog.js';

/** `Environment`'s constructor weights, finest mip first. */
const DEFAULT_GLOW_LEVELS = [0.0, 0.8, 0.4, 0.1, 0.0, 0.0, 0.0];

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

export function decodeEnvironment(properties: Record<string, string>): EnvironmentProperties {
  const fogMode = enumOr(properties.fog_mode, FogMode.EXPONENTIAL, Object.values(FogMode), 'fog_mode');
  const fogDepthRange = depthFogRange({
    begin: parseOptionalFloat(properties.fog_depth_begin),
    end: parseOptionalFloat(properties.fog_depth_end),
  });
  return {
    // Background
    background_mode: intOr(properties.background_mode, 0, 'background_mode') as BackgroundMode,
    background_color: colorOr(properties.background_color, { r: 0, g: 0, b: 0, a: 1 }),
    background_energy_multiplier: floatOr(
      properties.background_energy_multiplier,
      1.0,
      'background_energy_multiplier'
    ),
    sky: properties.sky,
    sky_rotation: vec3Or(properties.sky_rotation, { x: 0, y: 0, z: 0 }, 'sky_rotation'),

    // Tonemapping. AgX reads its own two properties rather than `tonemap_white`
    // (`Environment::_update_tonemap`), and their defaults are Blender's AgX
    // values, 16.29 and 1.25 (`environment.h`), not the other curve's 1.0.
    tonemap_mode: intOr(properties.tonemap_mode, 0, 'tonemap_mode'),
    tonemap_white: floatOr(properties.tonemap_white, 1.0, 'tonemap_white'),
    tonemap_agx_white: floatOr(properties.tonemap_agx_white, 16.29, 'tonemap_agx_white'),
    tonemap_agx_contrast: floatOr(
      properties.tonemap_agx_contrast,
      DEFAULT_AGX_CONTRAST,
      'tonemap_agx_contrast'
    ),
    tonemap_exposure: floatOr(properties.tonemap_exposure, 1.0, 'tonemap_exposure'),

    // Ambient lighting: Godot's default ambient_light_color is black, no ambient.
    ambient_light_source: intOr(properties.ambient_light_source, 0, 'ambient_light_source'),
    ambient_light_color: colorOr(properties.ambient_light_color, { r: 0, g: 0, b: 0, a: 1 }),
    ambient_light_energy: floatOr(properties.ambient_light_energy, 1.0, 'ambient_light_energy'),
    ambient_light_sky_contribution: floatOr(
      properties.ambient_light_sky_contribution,
      1.0,
      'ambient_light_sky_contribution'
    ),

    // Depth fog.
    fog_enabled: boolSlotValue(properties.fog_enabled) === true,
    fog_mode: fogMode,
    fog_light_color: colorOr(properties.fog_light_color, { r: 0.518, g: 0.553, b: 0.608, a: 1 }),
    fog_light_energy: floatOr(properties.fog_light_energy, 1.0, 'fog_light_energy'),
    fog_sun_scatter: floatOr(properties.fog_sun_scatter, 0.0, 'fog_sun_scatter'),
    fog_density: floatOr(properties.fog_density, depthFogDensityDefault(fogMode), 'fog_density'),
    fog_aerial_perspective: floatOr(properties.fog_aerial_perspective, 0.0, 'fog_aerial_perspective'),
    fog_sky_affect: floatOr(properties.fog_sky_affect, 1.0, 'fog_sky_affect'),
    fog_height: floatOr(properties.fog_height, 0.0, 'fog_height'),
    fog_height_density: floatOr(properties.fog_height_density, 0.0, 'fog_height_density'),
    fog_depth_curve: floatOr(properties.fog_depth_curve, 1.0, 'fog_depth_curve'),
    fog_depth_begin: fogDepthRange.begin,
    fog_depth_end: fogDepthRange.end,

    // Volumetric Fog
    volumetric_fog_enabled: boolSlotValue(properties.volumetric_fog_enabled) === true,
    volumetric_fog_density: floatOr(properties.volumetric_fog_density, 0.05, 'volumetric_fog_density'),
    volumetric_fog_albedo: colorOr(properties.volumetric_fog_albedo, { r: 1, g: 1, b: 1, a: 1 }),
    volumetric_fog_emission: colorOr(properties.volumetric_fog_emission, { r: 0, g: 0, b: 0, a: 1 }),
    volumetric_fog_emission_energy: floatOr(
      properties.volumetric_fog_emission_energy,
      1.0,
      'volumetric_fog_emission_energy'
    ),
    volumetric_fog_anisotropy: floatOr(
      properties.volumetric_fog_anisotropy,
      0.2,
      'volumetric_fog_anisotropy'
    ),
    volumetric_fog_length: floatOr(properties.volumetric_fog_length, 64.0, 'volumetric_fog_length'),
    volumetric_fog_detail_spread: volumetricFogDetailSpread(
      floatOr(properties.volumetric_fog_detail_spread, 2.0, 'volumetric_fog_detail_spread')
    ),
    volumetric_fog_ambient_inject: floatOr(
      properties.volumetric_fog_ambient_inject,
      0.0,
      'volumetric_fog_ambient_inject'
    ),
    volumetric_fog_sky_affect: floatOr(
      properties.volumetric_fog_sky_affect,
      1.0,
      'volumetric_fog_sky_affect'
    ),
    volumetric_fog_temporal_reprojection_enabled:
      boolSlotValue(properties.volumetric_fog_temporal_reprojection_enabled) !== false,
    volumetric_fog_temporal_reprojection_amount: floatOr(
      properties.volumetric_fog_temporal_reprojection_amount,
      0.9,
      'volumetric_fog_temporal_reprojection_amount'
    ),

    // Glow.
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
    glow_hdr_luminance_cap: floatOr(properties.glow_hdr_luminance_cap, 12.0, 'glow_hdr_luminance_cap'),
    glow_map_strength: floatOr(properties.glow_map_strength, 0.8, 'glow_map_strength'),
    glow_map: properties.glow_map,

    adjustment_enabled: boolSlotValue(properties.adjustment_enabled) === true,
    adjustment_brightness: floatOr(properties.adjustment_brightness, 1.0, 'adjustment_brightness'),
    adjustment_contrast: floatOr(properties.adjustment_contrast, 1.0, 'adjustment_contrast'),
    adjustment_saturation: floatOr(properties.adjustment_saturation, 1.0, 'adjustment_saturation'),
  };
}
