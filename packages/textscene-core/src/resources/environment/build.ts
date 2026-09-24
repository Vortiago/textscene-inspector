/**
 * Environment slice build (ADR-0031): decoded `EnvironmentProperties` in, the
 * `EnvironmentSettings` the render layer applies out. Plain data, not a THREE object:
 * the renderer and scene it applies to outlive it, and the r3f layer owns them.
 */

import { BackgroundMode, type EnvironmentProperties, type EnvironmentSettings } from './types';
import type { Color } from '../../utils/colorParser';
import { GodotToneMapper } from './godotToneMapping';

export type { EnvironmentSettings } from './types';

/**
 * The white the tonemapper gets, as `Environment::_update_tonemap` (`scene/resources/environment.cpp`)
 * passes `tonemap_agx_white` for AgX: its default is Blender's 16.29, the shoulder's
 * high-clip point, and `tonemap_white` would saturate every input at or above 2.0.
 * The authored value: `resolvedWhite` applies the per-curve floors (`environment_get_white`).
 */
function whiteFor(properties: EnvironmentProperties): number {
  return properties.tonemap_mode === GodotToneMapper.AGX
    ? properties.tonemap_agx_white
    : properties.tonemap_white;
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
    ...ambientFor(properties),
    toneMapping: {
      mode: properties.tonemap_mode,
      exposure: properties.tonemap_exposure,
      white: whiteFor(properties),
      agxContrast: properties.tonemap_agx_contrast,
    },
    // Scene fog follows Godot's screen-space fog. Volumetric fog has no THREE
    // equivalent and is not applied.
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
    glow: properties.glow_enabled
      ? {
          levels: glowLevelsFor(properties),
          intensity: properties.glow_intensity,
          strength: properties.glow_strength,
          mix: properties.glow_mix,
          bloom: properties.glow_bloom,
          blendMode: properties.glow_blend_mode,
          hdrThreshold: properties.glow_hdr_threshold,
          hdrScale: properties.glow_hdr_scale,
          luminanceCap: properties.glow_hdr_luminance_cap,
        }
      : null,
  };
}

/**
 * `Environment::_update_glow`'s level weights: sum-normalised under
 * `glow_normalized`, passed through otherwise. Godot divides by the sum with no
 * guard, so an all-zero set would hand the shader NaN. Weights that sum to zero
 * contribute nothing either way, so they pass through instead.
 */
function glowLevelsFor(properties: EnvironmentProperties): number[] {
  const levels = properties.glow_levels;
  if (!properties.glow_normalized) return levels;
  const sum = levels.reduce((total, weight) => total + weight, 0);
  return sum > 0 ? levels.map((weight) => weight / sum) : levels;
}

/** Godot's ProjectSettings `rendering/environment/defaults/default_clear_color`. */
const DEFAULT_CLEAR_COLOR: Color = { r: 0.3, g: 0.3, b: 0.3, a: 1 };

const AMBIENT_SOURCE_BG = 0;
const AMBIENT_SOURCE_COLOR = 2;
const AMBIENT_SOURCE_SKY = 3;

/**
 * The ambient this Environment contributes, transcribed from
 * `RenderSceneDataRD::update_ubo`, which fills the shader's ambient
 * (`sky_bake_panorama` is the baking path, a different table). Colours stay in
 * Godot space: the consumer converts sRGB to linear.
 */
function ambientFor(properties: EnvironmentProperties): {
  ambient: EnvironmentSettings['ambient'];
  skyAmbient: EnvironmentSettings['skyAmbient'];
} {
  const source = properties.ambient_light_source;
  const background = properties.background_mode;

  // BG (0, the default source) over BG_CLEAR_COLOR or BG_COLOR: flat = that colour
  // × background_energy_multiplier.
  if (source === AMBIENT_SOURCE_BG && (background === 0 || background === 1)) {
    return {
      ambient: {
        color: background === 0 ? DEFAULT_CLEAR_COLOR : properties.background_color,
        energy: properties.background_energy_multiplier,
      },
      skyAmbient: null,
    };
  }

  // Otherwise flat = ambient_light_color × ambient_light_energy, and the cubemap is
  // used for (BG + BG_SKY) or SKY.
  const overSky = background === BackgroundMode.BG_SKY;
  const fromCubemap =
    (source === AMBIENT_SOURCE_BG && overSky) || source === AMBIENT_SOURCE_SKY;

  // The shader blends ambient = mix(flat, sky × background_energy_multiplier,
  // sky_contribution), folded into the energies: at the default 1.0 the flat term is
  // zero, so `ambient_light_color` under AMBIENT_SOURCE_SKY leaves no trace in Godot.
  // A COLOR or DISABLED source takes none from the sky, which is still reflected.
  const contribution = fromCubemap ? properties.ambient_light_sky_contribution : 0;

  // `reflection_source` defaults to the background, so a sky is reflected whenever it
  // is the background or the ambient, independent of `ambient_light_source`. `energy`
  // carries the reflection, `contribution` the diffuse share, scaled apart per material.
  const skyAmbient =
    fromCubemap || overSky
      ? { energy: properties.background_energy_multiplier, contribution }
      : null;

  if (!fromCubemap && source !== AMBIENT_SOURCE_COLOR) {
    return { ambient: null, skyAmbient };
  }

  return {
    ambient: {
      color: properties.ambient_light_color,
      energy: properties.ambient_light_energy * (1 - contribution),
    },
    skyAmbient,
  };
}
