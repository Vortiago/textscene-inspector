/**
 * Environment slice BUILD (ADR-0031): decoded `EnvironmentProperties` in, the
 * `EnvironmentSettings` the render layer applies out.
 *
 * Plain data rather than a THREE object, because an Environment is applied to a
 * renderer and a scene that both outlive it — the r3f layer owns that, and gets
 * one already-resolved description to apply.
 */

import { BackgroundMode, type EnvironmentProperties, type EnvironmentSettings } from './types';
import type { Color } from '../../utils/colorParser';
import { GodotToneMapper } from './godotToneMapping';

export type { EnvironmentSettings } from './types';

/**
 * Which white the tonemapper is handed, transcribed from
 * `Environment::_update_tonemap` (`scene/resources/environment.cpp`):
 *
 *   environment_set_tonemap(..., tone_mapper == TONE_MAPPER_AGX
 *       ? tonemap_agx_white : tonemap_white)
 *
 * AgX carries its own white because its default is Blender's 16.29 rather than
 * 1.0, and the shoulder is shaped around it. For AgX the white is the shoulder's
 * high-clip point rather than a normalisation divisor, so the two agree below
 * middle grey and diverge sharply above it — reading `tonemap_white` here
 * saturates every linear input at or above 2.0 that should still be resolving.
 *
 * The per-curve FLOORS Godot then applies (`environment_get_white`) are not
 * folded in here: they belong to the curve, and `resolvedWhite` applies them
 * where it is built, so this carries the authored value for anything that needs
 * it unclamped.
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
    // Scene fog is driven by Godot's screen-space fog; volumetric fog has no
    // THREE equivalent and is intentionally not applied.
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
 * guard, so an all-zero set would hand the shader NaN; weights that sum to zero
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
 * `RenderSceneDataRD::update_ubo` — the code that fills the shader's ambient.
 * (`sky_bake_panorama` looks similar and is NOT the same table; it is the
 * baking path.)
 *
 *   BG (0, the DEFAULT source) + BG_CLEAR_COLOR / BG_COLOR
 *       → flat = that colour × background_energy_multiplier
 *   otherwise
 *       → flat    = ambient_light_color × ambient_light_energy
 *         cubemap = (BG + BG_SKY) or SKY
 *         used    = cubemap or COLOR
 *
 * and the shader then blends the two DIFFUSE terms:
 *
 *   ambient = mix(flat, sky × background_energy_multiplier, sky_contribution)
 *
 * The blend is folded into the returned energies so the render layer applies
 * each term at the strength it already has: at the default contribution of 1.0
 * the flat term is scaled to zero, which is why a scene that sets
 * `ambient_light_color` under `AMBIENT_SOURCE_SKY` sees no trace of it in
 * Godot. The sRGB→linear conversion happens at the consumer, so colours stay
 * in Godot space here.
 *
 * REFLECTIONS are separate. `reflection_source` defaults to the background, so
 * a sky is reflected by metals whenever it is the background — INDEPENDENT of
 * `ambient_light_source`. `skyAmbient` therefore appears whenever a sky IBL
 * exists (sky background, or `AMBIENT_SOURCE_SKY`), carrying the reflection
 * energy in `energy` and the DIFFUSE share in `contribution`; the render layer
 * scales the two apart per-material. Only a solid-colour background with no
 * sky truly has no reflection source.
 */
function ambientFor(properties: EnvironmentProperties): {
  ambient: EnvironmentSettings['ambient'];
  skyAmbient: EnvironmentSettings['skyAmbient'];
} {
  const source = properties.ambient_light_source;
  const background = properties.background_mode;

  if (source === AMBIENT_SOURCE_BG && (background === 0 || background === 1)) {
    return {
      ambient: {
        color: background === 0 ? DEFAULT_CLEAR_COLOR : properties.background_color,
        energy: properties.background_energy_multiplier,
      },
      skyAmbient: null,
    };
  }

  const overSky = background === BackgroundMode.BG_SKY;
  const fromCubemap =
    (source === AMBIENT_SOURCE_BG && overSky) || source === AMBIENT_SOURCE_SKY;

  // How much of the DIFFUSE ambient the sky accounts for. A COLOR source (or
  // DISABLED) takes none from the sky — only the flat colour — so its
  // contribution is 0, but the sky is still reflected below.
  const contribution = fromCubemap ? properties.ambient_light_sky_contribution : 0;

  // The sky IBL exists — and is reflected — whenever it is the background or
  // the ambient is baked from it, whatever lights the diffuse ambient.
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
