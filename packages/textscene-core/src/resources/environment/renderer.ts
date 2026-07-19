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
  /**
   * Flat ambient — null when the source emits none (DISABLED) or when the
   * ambient is a cubemap rather than a constant (a sky background).
   */
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
    ambient: ambientFor(properties),
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

/**
 * The flat ambient this Environment contributes, per Godot's
 * `AmbientSource` × `BGMode` table (identical in the RD and GLES3 renderers).
 *
 *   BG (0, the DEFAULT source)
 *     ├─ BG_CLEAR_COLOR (0, the DEFAULT mode) → default_clear_color × background_energy
 *     ├─ BG_COLOR (1)                          → background_color   × background_energy
 *     └─ anything else (sky, canvas, …)        → not flat; a cubemap or nothing
 *   DISABLED (1)                               → none
 *   COLOR (2) / SKY (3)                        → ambient_light_color × ambient_light_energy
 *
 * The sRGB→linear conversion happens at the consumer (`godotColorToLinear` in
 * the WorldEnvironment component), so these stay Godot-space colours.
 */
function ambientFor(properties: EnvironmentProperties): EnvironmentSettings['ambient'] {
  if (properties.ambient_light_source === 0) {
    if (properties.background_mode !== 0 && properties.background_mode !== 1) return null;
    return {
      color: properties.background_mode === 0 ? DEFAULT_CLEAR_COLOR : properties.background_color,
      energy: properties.background_energy_multiplier,
    };
  }
  if (properties.ambient_light_source === 2 || properties.ambient_light_source === 3) {
    return { color: properties.ambient_light_color, energy: properties.ambient_light_energy };
  }
  return null;
}
