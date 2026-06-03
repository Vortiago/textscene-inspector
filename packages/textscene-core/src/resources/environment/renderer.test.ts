/**
 * Environment renderer tests
 */

import { describe, it, expect } from 'vitest';
import { createEnvironmentSettings } from './renderer';
import { BackgroundMode } from './types';
import type { EnvironmentProperties } from './types';

function base(over: Partial<EnvironmentProperties> = {}): EnvironmentProperties {
  return {
    background_mode: BackgroundMode.BG_COLOR,
    background_color: { r: 0, g: 0, b: 0, a: 1 },
    background_energy_multiplier: 1.0,
    ambient_light_source: 0,
    ambient_light_color: { r: 0, g: 0, b: 0, a: 1 },
    ambient_light_energy: 1.0,
    fog_enabled: false,
    fog_density: 0.01,
    fog_light_color: { r: 0.518, g: 0.553, b: 0.608, a: 1 },
    fog_mode: 0,
    volumetric_fog_enabled: false,
    volumetric_fog_density: 0.05,
    volumetric_fog_albedo: { r: 1, g: 1, b: 1, a: 1 },
    volumetric_fog_emission: { r: 0, g: 0, b: 0, a: 1 },
    adjustment_enabled: false,
    adjustment_brightness: 1.0,
    adjustment_contrast: 1.0,
    adjustment_saturation: 1.0,
    ssr_enabled: false,
    ...over,
  };
}

describe('createEnvironmentSettings', () => {
  it('should create settings with background only', () => {
    const settings = createEnvironmentSettings(
      base({ background_color: { r: 0.15, g: 0.12, b: 0.1, a: 1 } })
    );

    expect(settings.background.mode).toBe(BackgroundMode.BG_COLOR);
    expect(settings.background.color).toEqual({ r: 0.15, g: 0.12, b: 0.1, a: 1 });
    expect(settings.background.energyMultiplier).toBe(1.0);
    expect(settings.fog).toBeNull();
    expect(settings.adjustments).toBeNull();
    expect(settings.ssr).toBeNull();
  });

  it('should create fog from Godot screen-space fog (fog_enabled)', () => {
    const settings = createEnvironmentSettings(
      base({ fog_enabled: true, fog_density: 0.001, fog_light_color: { r: 0.8, g: 0.8, b: 0.9, a: 1 }, fog_mode: 1 })
    );

    expect(settings.fog).not.toBeNull();
    expect(settings.fog?.density).toBe(0.001);
    expect(settings.fog?.color).toEqual({ r: 0.8, g: 0.8, b: 0.9, a: 1 });
    expect(settings.fog?.mode).toBe(1);
  });

  it('does NOT drive scene fog from volumetric_fog (no THREE equivalent)', () => {
    const settings = createEnvironmentSettings(base({ volumetric_fog_enabled: true }));
    expect(settings.fog).toBeNull();
  });

  it('gates flat ambient on ambient_light_source', () => {
    expect(createEnvironmentSettings(base()).ambient).toBeNull(); // BG (0)
    expect(createEnvironmentSettings(base({ ambient_light_source: 1 })).ambient).toBeNull(); // DISABLED
    const colored = createEnvironmentSettings(
      base({ ambient_light_source: 2, ambient_light_color: { r: 0.2, g: 0.2, b: 0.2, a: 1 }, ambient_light_energy: 0.5 })
    );
    expect(colored.ambient?.color).toEqual({ r: 0.2, g: 0.2, b: 0.2, a: 1 });
    expect(colored.ambient?.energy).toBe(0.5);
  });

  it('should create settings with adjustments enabled', () => {
    const settings = createEnvironmentSettings(
      base({ adjustment_enabled: true, adjustment_brightness: 1.05, adjustment_contrast: 1.1, adjustment_saturation: 1.2 })
    );

    expect(settings.adjustments).not.toBeNull();
    expect(settings.adjustments?.brightness).toBe(1.05);
    expect(settings.adjustments?.contrast).toBe(1.1);
    expect(settings.adjustments?.saturation).toBe(1.2);
  });

  it('should create settings with SSR enabled', () => {
    const settings = createEnvironmentSettings(base({ ssr_enabled: true }));
    expect(settings.ssr).not.toBeNull();
    expect(settings.ssr?.enabled).toBe(true);
  });

  it('should create settings with all features enabled', () => {
    const settings = createEnvironmentSettings(
      base({
        background_color: { r: 0.2, g: 0.3, b: 0.4, a: 1 },
        background_energy_multiplier: 1.5,
        fog_enabled: true,
        fog_density: 0.002,
        fog_light_color: { r: 0.9, g: 0.9, b: 1.0, a: 1 },
        adjustment_enabled: true,
        adjustment_brightness: 1.15,
        ssr_enabled: true,
      })
    );

    expect(settings.background.color).toEqual({ r: 0.2, g: 0.3, b: 0.4, a: 1 });
    expect(settings.background.energyMultiplier).toBe(1.5);
    expect(settings.fog?.density).toBe(0.002);
    expect(settings.fog?.color).toEqual({ r: 0.9, g: 0.9, b: 1.0, a: 1 });
    expect(settings.adjustments?.brightness).toBe(1.15);
    expect(settings.ssr).not.toBeNull();
  });
});
