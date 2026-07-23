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
   * The sky as an image-based light — an IBL, not a constant, so it both lights
   * surfaces and is what they reflect. Present whenever a sky IBL exists to
   * reflect (`reflection_source` defaults to the background), which under a sky
   * background is INDEPENDENT of where the diffuse ambient comes from: a metal
   * reflects the sky even when the flat ambient is a constant colour.
   *
   * `energy` is Godot's `background_energy_multiplier` — the sky's reflection
   * strength. `contribution` is `ambient_light_sky_contribution`: how much of
   * the DIFFUSE ambient the sky accounts for versus the flat colour (0 for
   * `AMBIENT_SOURCE_COLOR`, so the sky is reflected but adds no diffuse). Godot
   * scales these two separately; three.js couples them under one
   * `environmentIntensity`, so the render layer restores the split with a
   * per-material `envMapIntensity` keyed on metalness.
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
    /** `tonemap_white` — the input the curve maps to 1.0. */
    white: number;
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
  /**
   * Glow/bloom post-process — null when disabled. A compositor pass (bloom on
   * pre-tonemap HDR luminance), so the render layer that consumes this must own
   * tonemapping too: bloom sits BEFORE the tonemapper (see `godotBloom.ts`).
   */
  glow: {
    /** HDR luminance a pixel must exceed to bloom (`glow_hdr_threshold`). */
    hdrThreshold: number;
    /** Additive strength of the glow buffer (`glow_intensity`). */
    intensity: number;
    /** Blur spread (`glow_strength`). */
    strength: number;
    /** Sub-threshold lift, 0..1 (`glow_bloom`). */
    bloom: number;
    /** 0 ADDITIVE, 1 SCREEN, 2 SOFTLIGHT, 3 REPLACE, 4 MIX. */
    blendMode: number;
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
      white: properties.tonemap_white,
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
    glow: properties.glow_enabled
      ? {
          hdrThreshold: properties.glow_hdr_threshold,
          intensity: properties.glow_intensity,
          strength: properties.glow_strength,
          bloom: properties.glow_bloom,
          blendMode: properties.glow_blend_mode,
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
