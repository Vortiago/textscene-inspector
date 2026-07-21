/**
 * Environment renderer - creates structured settings object for applying to THREE.js scene
 */

import { BackgroundMode, type EnvironmentProperties } from './types';
import type { Color } from '../materials/standardmaterial3d/types';

export interface EnvironmentSettings {
  background: {
    mode: number;
    color: Color;
    energyMultiplier: number;
  };
  /**
   * Flat ambient — null when the source emits none (DISABLED) or when the
   * ambient is a cubemap rather than a constant (a sky background).
   */
  ambient: {
    color: Color;
    energy: number;
  } | null;
  /**
   * The sky's own radiance as an ambient source — an IBL, not a constant, so
   * it both lights surfaces and is what they reflect. `energy` is Godot's
   * `background_energy_multiplier`; `contribution` is how much of the ambient
   * it accounts for versus the flat colour.
   */
  skyAmbient: {
    energy: number;
    contribution: number;
  } | null;
  /**
   * Godot's tonemapper. Always present — LINEAR (the default) is a real
   * choice meaning "no tone mapping", not an absence, and the editor preview
   * environment deliberately picks FILMIC instead.
   */
  toneMapping: {
    mode: number;
    exposure: number;
  };
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
    ...ambientFor(properties),
    toneMapping: {
      mode: properties.tonemap_mode,
      exposure: properties.tonemap_exposure,
    },
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
 * and the shader then blends the two:
 *
 *   ambient = mix(flat, sky × background_energy_multiplier, sky_contribution)
 *
 * The blend is folded into the returned energies so the render layer applies
 * each term at the strength it already has: at the default contribution of 1.0
 * the flat term is scaled to zero, which is why a scene that sets
 * `ambient_light_color` under `AMBIENT_SOURCE_SKY` sees no trace of it in
 * Godot. The sRGB→linear conversion happens at the consumer, so colours stay
 * in Godot space here.
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

  const fromCubemap =
    (source === AMBIENT_SOURCE_BG && background === BackgroundMode.BG_SKY) ||
    source === AMBIENT_SOURCE_SKY;
  if (!fromCubemap && source !== AMBIENT_SOURCE_COLOR) {
    return { ambient: null, skyAmbient: null };
  }

  const contribution = fromCubemap ? properties.ambient_light_sky_contribution : 0;
  return {
    ambient: {
      color: properties.ambient_light_color,
      energy: properties.ambient_light_energy * (1 - contribution),
    },
    skyAmbient: fromCubemap
      ? { energy: properties.background_energy_multiplier, contribution }
      : null,
  };
}
