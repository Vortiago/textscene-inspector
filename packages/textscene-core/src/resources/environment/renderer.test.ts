/**
 * Environment renderer tests
 */

import { describe, it, expect } from 'vitest';
import { createEnvironmentSettings } from './renderer';
import { BackgroundMode } from './types';
import type { EnvironmentProperties } from './types';

describe('createEnvironmentSettings', () => {
  it('should create settings with background only', () => {
    const props: EnvironmentProperties = {
      background_mode: BackgroundMode.BG_COLOR,
      background_color: { r: 0.15, g: 0.12, b: 0.1, a: 1 },
      background_energy_multiplier: 1.0,
      volumetric_fog_enabled: false,
      volumetric_fog_density: 0.05,
      volumetric_fog_albedo: { r: 1, g: 1, b: 1, a: 1 },
      volumetric_fog_emission: { r: 0, g: 0, b: 0, a: 1 },
      adjustment_enabled: false,
      adjustment_brightness: 1.0,
      adjustment_contrast: 1.0,
      adjustment_saturation: 1.0,
      ssr_enabled: false,
    };

    const settings = createEnvironmentSettings(props);

    expect(settings.background.mode).toBe(BackgroundMode.BG_COLOR);
    expect(settings.background.color).toEqual({ r: 0.15, g: 0.12, b: 0.1, a: 1 });
    expect(settings.background.energyMultiplier).toBe(1.0);
    expect(settings.fog).toBeNull();
    expect(settings.adjustments).toBeNull();
    expect(settings.ssr).toBeNull();
  });

  it('should create settings with fog enabled', () => {
    const props: EnvironmentProperties = {
      background_mode: BackgroundMode.BG_COLOR,
      background_color: { r: 0, g: 0, b: 0, a: 1 },
      background_energy_multiplier: 1.0,
      volumetric_fog_enabled: true,
      volumetric_fog_density: 0.001,
      volumetric_fog_albedo: { r: 0.8, g: 0.8, b: 0.9, a: 1 },
      volumetric_fog_emission: { r: 0, g: 0, b: 0, a: 1 },
      adjustment_enabled: false,
      adjustment_brightness: 1.0,
      adjustment_contrast: 1.0,
      adjustment_saturation: 1.0,
      ssr_enabled: false,
    };

    const settings = createEnvironmentSettings(props);

    expect(settings.fog).not.toBeNull();
    expect(settings.fog?.enabled).toBe(true);
    expect(settings.fog?.density).toBe(0.001);
    expect(settings.fog?.albedo).toEqual({ r: 0.8, g: 0.8, b: 0.9, a: 1 });
    expect(settings.fog?.emission).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('should create settings with adjustments enabled', () => {
    const props: EnvironmentProperties = {
      background_mode: BackgroundMode.BG_CLEAR_COLOR,
      background_color: { r: 0, g: 0, b: 0, a: 1 },
      background_energy_multiplier: 1.0,
      volumetric_fog_enabled: false,
      volumetric_fog_density: 0.05,
      volumetric_fog_albedo: { r: 1, g: 1, b: 1, a: 1 },
      volumetric_fog_emission: { r: 0, g: 0, b: 0, a: 1 },
      adjustment_enabled: true,
      adjustment_brightness: 1.05,
      adjustment_contrast: 1.1,
      adjustment_saturation: 1.2,
      ssr_enabled: false,
    };

    const settings = createEnvironmentSettings(props);

    expect(settings.adjustments).not.toBeNull();
    expect(settings.adjustments?.enabled).toBe(true);
    expect(settings.adjustments?.brightness).toBe(1.05);
    expect(settings.adjustments?.contrast).toBe(1.1);
    expect(settings.adjustments?.saturation).toBe(1.2);
  });

  it('should create settings with SSR enabled', () => {
    const props: EnvironmentProperties = {
      background_mode: BackgroundMode.BG_CLEAR_COLOR,
      background_color: { r: 0, g: 0, b: 0, a: 1 },
      background_energy_multiplier: 1.0,
      volumetric_fog_enabled: false,
      volumetric_fog_density: 0.05,
      volumetric_fog_albedo: { r: 1, g: 1, b: 1, a: 1 },
      volumetric_fog_emission: { r: 0, g: 0, b: 0, a: 1 },
      adjustment_enabled: false,
      adjustment_brightness: 1.0,
      adjustment_contrast: 1.0,
      adjustment_saturation: 1.0,
      ssr_enabled: true,
    };

    const settings = createEnvironmentSettings(props);

    expect(settings.ssr).not.toBeNull();
    expect(settings.ssr?.enabled).toBe(true);
  });

  it('should create settings with all features enabled', () => {
    const props: EnvironmentProperties = {
      background_mode: BackgroundMode.BG_COLOR,
      background_color: { r: 0.2, g: 0.3, b: 0.4, a: 1 },
      background_energy_multiplier: 1.5,
      volumetric_fog_enabled: true,
      volumetric_fog_density: 0.002,
      volumetric_fog_albedo: { r: 0.9, g: 0.9, b: 1.0, a: 1 },
      volumetric_fog_emission: { r: 0.1, g: 0.05, b: 0, a: 1 },
      adjustment_enabled: true,
      adjustment_brightness: 1.15,
      adjustment_contrast: 1.05,
      adjustment_saturation: 1.3,
      ssr_enabled: true,
    };

    const settings = createEnvironmentSettings(props);

    // Background
    expect(settings.background.mode).toBe(BackgroundMode.BG_COLOR);
    expect(settings.background.color).toEqual({ r: 0.2, g: 0.3, b: 0.4, a: 1 });
    expect(settings.background.energyMultiplier).toBe(1.5);

    // Fog
    expect(settings.fog).not.toBeNull();
    expect(settings.fog?.density).toBe(0.002);
    expect(settings.fog?.albedo).toEqual({ r: 0.9, g: 0.9, b: 1.0, a: 1 });

    // Adjustments
    expect(settings.adjustments).not.toBeNull();
    expect(settings.adjustments?.brightness).toBe(1.15);

    // SSR
    expect(settings.ssr).not.toBeNull();
  });

  it('should handle fog emission values correctly', () => {
    const props: EnvironmentProperties = {
      background_mode: BackgroundMode.BG_CLEAR_COLOR,
      background_color: { r: 0, g: 0, b: 0, a: 1 },
      background_energy_multiplier: 1.0,
      volumetric_fog_enabled: true,
      volumetric_fog_density: 0.01,
      volumetric_fog_albedo: { r: 1, g: 1, b: 1, a: 1 },
      volumetric_fog_emission: { r: 0.5, g: 0.3, b: 0.1, a: 1 },
      adjustment_enabled: false,
      adjustment_brightness: 1.0,
      adjustment_contrast: 1.0,
      adjustment_saturation: 1.0,
      ssr_enabled: false,
    };

    const settings = createEnvironmentSettings(props);

    expect(settings.fog?.emission).toEqual({ r: 0.5, g: 0.3, b: 0.1, a: 1 });
  });
});
