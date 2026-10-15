/**
 * Environment slice build: `EnvironmentProperties` in, render settings out. The
 * factory below is the decoder's complete property bag at Godot's `Environment` constructor
 * values: a partial one hands the build `undefined`, which produces NaN, not a failure.
 */

import { describe, it, expect } from 'vitest';
import { createEnvironmentSettings } from './build';
import { decodeEnvironment } from './decode';
import { BackgroundMode } from './types';
import type { EnvironmentProperties } from './types';
import { DEFAULT_CLEAR_COLOR } from '../../godot/rendering';

function base(over: Partial<EnvironmentProperties> = {}): EnvironmentProperties {
  return { ...decodeEnvironment({}), background_mode: BackgroundMode.BG_COLOR, ...over };
}

describe('createEnvironmentSettings', () => {
  it('should create settings with background only', () => {
    const settings = createEnvironmentSettings(
      base({ background_color: { r: 0.15, g: 0.12, b: 0.1, a: 1 } }),
      DEFAULT_CLEAR_COLOR
    );

    expect(settings.background.mode).toBe(BackgroundMode.BG_COLOR);
    expect(settings.background.color).toEqual({ r: 0.15, g: 0.12, b: 0.1, a: 1 });
    expect(settings.background.energyMultiplier).toBe(1.0);
    expect(settings.fog).toBeNull();
    expect(settings.adjustments).toBeNull();
  });

  it('draws the clear colour, not background_color, under BG_CLEAR_COLOR', () => {
    const red = { r: 1, g: 0, b: 0, a: 1 };
    const settings = createEnvironmentSettings(
      base({ background_mode: BackgroundMode.BG_CLEAR_COLOR, background_color: { r: 0, g: 0, b: 1, a: 1 } }),
      red
    );
    expect(settings.background.color).toEqual(red);
  });

  it('scales the drawn background colour by the energy multiplier, as Godot scales its clear', () => {
    const settings = createEnvironmentSettings(
      base({ background_color: { r: 0.2, g: 0.3, b: 0.4, a: 1 }, background_energy_multiplier: 2 }),
      DEFAULT_CLEAR_COLOR
    );
    expect(settings.background.color).toEqual({ r: 0.4, g: 0.6, b: 0.8, a: 1 });
  });

  it('carries every depth fog term while fog_enabled is on', () => {
    const settings = createEnvironmentSettings(
      base({
        fog_enabled: true,
        fog_mode: 1,
        fog_light_color: { r: 0.8, g: 0.8, b: 0.9, a: 1 },
        fog_light_energy: 2,
        fog_sun_scatter: 0.5,
        fog_density: 0.7,
        fog_aerial_perspective: 0.25,
        fog_sky_affect: 0.4,
        fog_height: 3,
        fog_height_density: -0.2,
        fog_depth_curve: 2,
        fog_depth_begin: 5,
        fog_depth_end: 40,
      }),
      DEFAULT_CLEAR_COLOR
    );

    expect(settings.fog).toEqual({
      mode: 1,
      color: { r: 0.8, g: 0.8, b: 0.9, a: 1 },
      lightEnergy: 2,
      sunScatter: 0.5,
      density: 0.7,
      aerialPerspective: 0.25,
      skyAffect: 0.4,
      height: 3,
      heightDensity: -0.2,
      depthCurve: 2,
      depthBegin: 5,
      depthEnd: 40,
    });
  });

  it('carries sky_rotation whatever the background', () => {
    const rotation = { x: 0.1, y: 0.2, z: 0.3 };
    expect(
      createEnvironmentSettings(base({ sky_rotation: rotation }), DEFAULT_CLEAR_COLOR).skyRotation
    ).toEqual(rotation);
  });

  it('carries the temporal reprojection amount while the reprojection is on', () => {
    const settings = createEnvironmentSettings(
      base({ volumetric_fog_enabled: true, volumetric_fog_temporal_reprojection_amount: 0.6 }),
      DEFAULT_CLEAR_COLOR
    );
    expect(settings.volumetricFog?.temporalReprojection).toBe(0.6);
  });

  it('keeps depth fog off when only volumetric fog is on', () => {
    const settings = createEnvironmentSettings(base({ volumetric_fog_enabled: true }), DEFAULT_CLEAR_COLOR);
    expect(settings.fog).toBeNull();
  });

  it('has no volumetric fog while volumetric_fog_enabled is off', () => {
    expect(createEnvironmentSettings(base(), DEFAULT_CLEAR_COLOR).volumetricFog).toBeNull();
  });

  it('carries the volumetric fog medium and pass, in Godot space', () => {
    const settings = createEnvironmentSettings(
      base({
        volumetric_fog_enabled: true,
        volumetric_fog_density: 0.1,
        volumetric_fog_albedo: { r: 0.6, g: 0.7, b: 0.9, a: 1 },
        volumetric_fog_emission: { r: 0.2, g: 0, b: 0, a: 1 },
        volumetric_fog_emission_energy: 2,
        volumetric_fog_anisotropy: -0.3,
        volumetric_fog_length: 32,
        volumetric_fog_detail_spread: 3,
        volumetric_fog_sky_affect: 0.5,
        volumetric_fog_temporal_reprojection_enabled: false,
      }),
      DEFAULT_CLEAR_COLOR
    );

    expect(settings.volumetricFog).toEqual({
      density: 0.1,
      albedo: { r: 0.6, g: 0.7, b: 0.9, a: 1 },
      emission: { r: 0.2, g: 0, b: 0, a: 1 },
      emissionEnergy: 2,
      anisotropy: -0.3,
      length: 32,
      detailSpread: 3,
      ambient: { inject: 0, color: { r: 0, g: 0, b: 0, a: 1 }, skyContribution: 1 },
      skyAffect: 0.5,
      temporalReprojection: null,
    });
  });

  it('scales the ambient inject by ambient_light_energy, whatever the ambient source', () => {
    // fog.cpp:1067-1076 reads the ambient colour, energy and sky contribution with no regard
    // for `ambient_light_source`: a BG source over a colour background still injects
    // `ambient_light_color`.
    const settings = createEnvironmentSettings(
      base({
        volumetric_fog_enabled: true,
        volumetric_fog_ambient_inject: 0.5,
        ambient_light_color: { r: 0.4, g: 0.3, b: 0.2, a: 1 },
        ambient_light_energy: 3,
        ambient_light_sky_contribution: 0.25,
      }),
      DEFAULT_CLEAR_COLOR
    );

    expect(settings.volumetricFog?.ambient).toEqual({
      inject: 1.5,
      color: { r: 0.4, g: 0.3, b: 0.2, a: 1 },
      skyContribution: 0.25,
    });
  });

  it('gates flat ambient on ambient_light_source', () => {
    // `base()` is BG source (0) with BG_COLOR (1), so the ambient is the
    // background colour: black here, but present rather than null.
    expect(createEnvironmentSettings(base(), DEFAULT_CLEAR_COLOR).ambient).toEqual({
      color: { r: 0, g: 0, b: 0, a: 1 },
      energy: 1,
    });
    expect(
      createEnvironmentSettings(base({ ambient_light_source: 1 }), DEFAULT_CLEAR_COLOR).ambient
    ).toBeNull(); // DISABLED
    const colored = createEnvironmentSettings(
      base({
        ambient_light_source: 2,
        ambient_light_color: { r: 0.2, g: 0.2, b: 0.2, a: 1 },
        ambient_light_energy: 0.5,
      }),
      DEFAULT_CLEAR_COLOR
    );
    expect(colored.ambient?.color).toEqual({ r: 0.2, g: 0.2, b: 0.2, a: 1 });
    expect(colored.ambient?.energy).toBe(0.5);
  });

  it('passes the contrast and saturation through unchanged', () => {
    const settings = createEnvironmentSettings(
      base({
        adjustment_enabled: true,
        adjustment_brightness: 1.05,
        adjustment_contrast: 1.1,
        adjustment_saturation: 1.2,
      }),
      DEFAULT_CLEAR_COLOR
    );

    expect(settings.adjustments?.contrast).toBe(1.1);
    expect(settings.adjustments?.saturation).toBe(1.2);
  });

  it('converts the brightness from sRGB to linear, as environment_set_adjustment stores it', () => {
    // `environment_storage.cpp:906`: the shader multiplies linear values by the stored brightness.
    const settings = createEnvironmentSettings(
      base({ adjustment_enabled: true, adjustment_brightness: 1.5 }),
      DEFAULT_CLEAR_COLOR
    );
    expect(settings.adjustments?.brightness).toBeCloseTo(2.537155239, 9);
  });

  it('divides a brightness below the sRGB knee by 12.92 (edge case)', () => {
    const settings = createEnvironmentSettings(
      base({ adjustment_enabled: true, adjustment_brightness: 0.02 }),
      DEFAULT_CLEAR_COLOR
    );
    expect(settings.adjustments?.brightness).toBeCloseTo(0.001547988, 9);
  });

  it('keeps a brightness of 0, which draws the frame black (edge case)', () => {
    const settings = createEnvironmentSettings(
      base({ adjustment_enabled: true, adjustment_brightness: 0 }),
      DEFAULT_CLEAR_COLOR
    );
    expect(settings.adjustments?.brightness).toBe(0);
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
      }),
      DEFAULT_CLEAR_COLOR
    );

    const { r, g, b } = settings.background.color;
    expect([r, g, b].map((c) => c.toFixed(6))).toEqual(['0.300000', '0.450000', '0.600000']);
    expect(settings.background.energyMultiplier).toBe(1.5);
    expect(settings.fog?.density).toBe(0.002);
    expect(settings.fog?.color).toEqual({ r: 0.9, g: 0.9, b: 1.0, a: 1 });
    expect(settings.adjustments?.brightness).toBeCloseTo(1.375824407, 9);
  });
});

describe('createEnvironmentSettings — which white the tonemapper is handed', () => {
  it('gives every non-AgX curve tonemap_white (happy path)', () => {
    // `Environment::_update_tonemap` picks between the two properties by mode.
    for (const mode of [0, 1, 2, 3]) {
      const settings = createEnvironmentSettings(
        base({ tonemap_mode: mode, tonemap_white: 6, tonemap_agx_white: 16.29 }),
        DEFAULT_CLEAR_COLOR
      );
      expect(settings.toneMapping.white, `mode ${mode}`).toBe(6);
    }
  });

  it('gives AGX its own tonemap_agx_white instead (regression)', () => {
    // `tonemap_white` would hand AgX a high clip of 1 (floored to 2), not Blender's
    // 16.29, and saturate every linear input at or above 2.0.
    const settings = createEnvironmentSettings(
      base({ tonemap_mode: 4, tonemap_white: 1, tonemap_agx_white: 16.29 }),
      DEFAULT_CLEAR_COLOR
    );
    expect(settings.toneMapping.white).toBeCloseTo(16.29, 6);
  });

  it('honours an authored tonemap_agx_white under AGX', () => {
    const settings = createEnvironmentSettings(
      base({ tonemap_mode: 4, tonemap_agx_white: 6 }),
      DEFAULT_CLEAR_COLOR
    );
    expect(settings.toneMapping.white).toBe(6);
  });

  it('leaves the per-curve floor to the curve, not to the settings (edge case)', () => {
    // `resolvedWhite` applies `environment_get_white`'s floors where the shader is
    // built. The settings carry the authored value unclamped.
    expect(
      createEnvironmentSettings(base({ tonemap_mode: 2, tonemap_white: 0.5 }), DEFAULT_CLEAR_COLOR)
        .toneMapping.white
    ).toBe(0.5);
  });

  it('carries the AgX contrast whatever the mode — only the curve reads it', () => {
    expect(createEnvironmentSettings(base(), DEFAULT_CLEAR_COLOR).toneMapping.agxContrast).toBe(1.25);
    expect(
      createEnvironmentSettings(base({ tonemap_mode: 4, tonemap_agx_contrast: 1.8 }), DEFAULT_CLEAR_COLOR)
        .toneMapping.agxContrast
    ).toBe(1.8);
    // Carried under FILMIC too: the settings describe the Environment, and the
    // mode gate lives in the curve rather than in what gets carried.
    expect(
      createEnvironmentSettings(base({ tonemap_mode: 2, tonemap_agx_contrast: 1.8 }), DEFAULT_CLEAR_COLOR)
        .toneMapping.agxContrast
    ).toBe(1.8);
  });
});

describe('AgX white end to end — select, then floor', () => {
  it('composes _update_tonemap’s pick with environment_get_white’s floor', async () => {
    // The composition: a bare `tonemap_mode = 4` scene reaches the shader at
    // Godot's 16.29, not the 2.0 that flooring `tonemap_white` would produce.
    const { decodeEnvironment } = await import('./decode');
    const { bakedToneMapWhite } = await import('./godotToneMapping.testkit');
    const settings = createEnvironmentSettings(decodeEnvironment({ tonemap_mode: '4' }), DEFAULT_CLEAR_COLOR);
    expect(bakedToneMapWhite(4, settings.toneMapping.white)).toBeCloseTo(16.29, 6);

    // ...and a scene that authors an AgX white BELOW Godot's floor still gets it.
    const floored = createEnvironmentSettings(
      decodeEnvironment({ tonemap_mode: '4', tonemap_agx_white: '0.5' }),
      DEFAULT_CLEAR_COLOR
    );
    expect(bakedToneMapWhite(4, floored.toneMapping.white)).toBe(2);
  });
});
