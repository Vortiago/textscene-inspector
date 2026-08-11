/**
 * Ambient light when the sky is the source.
 *
 * Transcribed from `RenderSceneDataRD::update_ubo` (Godot 4.6), which is the
 * code that actually fills the shader's ambient — not `sky_bake_panorama`,
 * which is the baking path and reads differently:
 *
 *   if (src == BG && (bg == CLEAR_COLOR || bg == COLOR)):
 *       flat = (bg == CLEAR_COLOR ? default_clear_color : bg_color) * bg_energy
 *       USE_AMBIENT_LIGHT
 *   else:
 *       flat = ambient_light_color * ambient_light_energy
 *       cubemap = (src == BG && bg == SKY) || src == SKY
 *       light   = cubemap || src == COLOR
 *
 * and the shader then blends:
 *
 *   ambient = flat
 *   if cubemap: ambient = mix(ambient, sky * bg_energy, ambient_color_sky_mix)
 *
 * Two consequences we had wrong: `AMBIENT_SOURCE_SKY` took `ambient_light_color`
 * at full strength (it is blended OUT entirely at the default contribution of
 * 1.0), and the sky's own contribution is scaled by `background_energy_multiplier`
 * — not by `ambient_light_energy`.
 *
 * REFLECTIONS are a separate channel: `reflection_source` defaults to the
 * background, so a sky is reflected by metals whenever it is the background,
 * WHATEVER lights the diffuse ambient. `skyAmbient` therefore carries the sky
 * reflection energy even for a COLOR or DISABLED source over a sky, with its
 * `contribution` (the diffuse share) at 0.
 */
import { describe, expect, it } from 'vitest';
import { createEnvironmentSettings } from './build';
import { BackgroundMode, type EnvironmentProperties } from './types';

const base = (overrides: Partial<EnvironmentProperties> = {}): EnvironmentProperties => ({
  background_mode: BackgroundMode.BG_SKY,
  background_color: { r: 0, g: 0, b: 0, a: 1 },
  background_energy_multiplier: 1.0,
  tonemap_mode: 0,
  tonemap_agx_white: 16.29,
  tonemap_agx_contrast: 1.25,
  tonemap_white: 1.0,
  tonemap_exposure: 1.0,
  ambient_light_source: 0,
  ambient_light_color: { r: 0, g: 0, b: 0, a: 1 },
  ambient_light_energy: 1.0,
  ambient_light_sky_contribution: 1.0,
  fog_enabled: false,
  fog_density: 0.01,
  fog_light_color: { r: 0.518, g: 0.553, b: 0.608, a: 1 },
  fog_mode: 0,
  volumetric_fog_enabled: false,
  volumetric_fog_density: 0.05,
  volumetric_fog_albedo: { r: 1, g: 1, b: 1, a: 1 },
  volumetric_fog_emission: { r: 0, g: 0, b: 0, a: 1 },
  glow_enabled: false,
  glow_levels: [0.0, 0.8, 0.4, 0.1, 0.0, 0.0, 0.0],
  glow_normalized: false,
  glow_intensity: 0.3,
  glow_strength: 1.0,
  glow_mix: 0.05,
  glow_bloom: 0.0,
  glow_blend_mode: 1,
  glow_hdr_threshold: 1.0,
  glow_hdr_scale: 2.0,
  glow_hdr_luminance_cap: 12.0,
  glow_map_strength: 0.8,
  adjustment_enabled: false,
  adjustment_brightness: 1,
  adjustment_contrast: 1,
  adjustment_saturation: 1,
  ssr_enabled: false,
  ...overrides,
});

describe('sky ambient', () => {
  it('takes ambient from the sky for the default source over a sky background', () => {
    // AMBIENT_SOURCE_BG (the default) + BG_SKY: this is the single most common
    // environment in the wild, and it previously produced NO ambient at all.
    const settings = createEnvironmentSettings(base());
    expect(settings.skyAmbient).toEqual({ energy: 1, contribution: 1 });
  });

  it('takes ambient from the sky for AMBIENT_SOURCE_SKY whatever the background is', () => {
    const settings = createEnvironmentSettings(
      base({ ambient_light_source: 3, background_mode: BackgroundMode.BG_COLOR })
    );
    expect(settings.skyAmbient).toEqual({ energy: 1, contribution: 1 });
  });

  it('scales the sky contribution by background_energy_multiplier, not ambient_light_energy', () => {
    const settings = createEnvironmentSettings(
      base({ background_energy_multiplier: 3, ambient_light_energy: 7 })
    );
    expect(settings.skyAmbient?.energy).toBe(3);
  });

  it('blends the flat colour out entirely at the default sky contribution', () => {
    // The bug: a scene setting ambient_light_color under AMBIENT_SOURCE_SKY
    // had that colour applied at full strength, on top of the sky.
    const settings = createEnvironmentSettings(
      base({
        ambient_light_source: 3,
        ambient_light_color: { r: 1, g: 0, b: 0, a: 1 },
        ambient_light_energy: 2,
      })
    );
    expect(settings.ambient?.energy).toBe(0);
  });

  it('keeps the flat colour in proportion when the sky contributes only part', () => {
    const settings = createEnvironmentSettings(
      base({
        ambient_light_source: 3,
        ambient_light_color: { r: 1, g: 0, b: 0, a: 1 },
        ambient_light_energy: 2,
        ambient_light_sky_contribution: 0.25,
      })
    );
    expect(settings.ambient).toEqual({ color: { r: 1, g: 0, b: 0, a: 1 }, energy: 1.5 });
    expect(settings.skyAmbient).toEqual({ energy: 1, contribution: 0.25 });
  });

  it('reflects the sky for a colour source but takes no diffuse from it', () => {
    // ambient_light_sky_contribution is meaningless for the DIFFUSE without a
    // cubemap source; Godot only reads it behind USE_AMBIENT_CUBEMAP. The sky
    // is still REFLECTED though (reflection_source defaults to the background),
    // so skyAmbient carries the reflection energy at diffuse contribution 0.
    const settings = createEnvironmentSettings(
      base({
        ambient_light_source: 2,
        ambient_light_color: { r: 0.4, g: 0.4, b: 0.4, a: 1 },
        ambient_light_sky_contribution: 0.5,
      })
    );
    expect(settings.skyAmbient).toEqual({ energy: 1, contribution: 0 });
    expect(settings.ambient).toEqual({ color: { r: 0.4, g: 0.4, b: 0.4, a: 1 }, energy: 1 });
  });

  it('reflects the sky for a disabled source but gives it no diffuse term', () => {
    // DISABLED ambient means no diffuse fill, but a sky background is still a
    // reflection source, so a metal keeps reflecting it.
    const settings = createEnvironmentSettings(base({ ambient_light_source: 1 }));
    expect(settings.ambient).toBeNull();
    expect(settings.skyAmbient).toEqual({ energy: 1, contribution: 0 });
  });

  it('leaves a colour background on the flat path, with no sky term', () => {
    const settings = createEnvironmentSettings(
      base({
        background_mode: BackgroundMode.BG_COLOR,
        background_color: { r: 0.6, g: 0.6, b: 0.6, a: 1 },
        background_energy_multiplier: 2,
      })
    );
    expect(settings.skyAmbient).toBeNull();
    expect(settings.ambient).toEqual({ color: { r: 0.6, g: 0.6, b: 0.6, a: 1 }, energy: 2 });
  });
});
