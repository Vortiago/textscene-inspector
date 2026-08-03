/**
 * Environment property validation, entirely through the shared `v` combinators.
 *
 * Every entry names its own property, so each emits an `INVALID_<PROPERTY>_FORMAT`
 * or `_VALUE` code rather than one generic code shared across unrelated properties,
 * and the enum entries name Godot's own constants in the message instead of printing
 * a bare numeric range.
 */

import { validatorRegistry } from '../../linter/ValidatorRegistry';
import { v } from '../../linter/validators/index.js';

// Register validators for Environment properties
validatorRegistry.registerAll('Environment', {
  background_mode: v.enumInt('background_mode', 0, 5, {
    0: 'BG_CLEAR_COLOR',
    1: 'BG_COLOR',
    2: 'BG_SKY',
    3: 'BG_CANVAS',
    4: 'BG_KEEP',
    5: 'BG_CAMERA_FEED',
  }),
  background_color: v.color('background_color'),
  background_energy_multiplier: v.nonNegativeFloat('background_energy_multiplier'),
  sky: v.resourceReference('sky'),

  // Ambient lighting — read by the render parser, so lint it too (parity).
  ambient_light_source: v.enumInt('ambient_light_source', 0, 3, {
    0: 'BG',
    1: 'DISABLED',
    2: 'COLOR',
    3: 'SKY',
  }),
  ambient_light_color: v.color('ambient_light_color'),
  ambient_light_energy: v.nonNegativeFloat('ambient_light_energy'),

  // Screen-space fog — read by the render parser (feeds the scene fog), so lint it.
  fog_enabled: v.boolean('fog_enabled'),
  fog_density: v.nonNegativeFloat('fog_density'),
  fog_light_color: v.color('fog_light_color'),
  fog_mode: v.enumInt('fog_mode', 0, 1, { 0: 'EXPONENTIAL', 1: 'DEPTH' }),

  // Tonemapping — parsed but not yet rendered; validate so it isn't silently ignored.
  tonemap_mode: v.enumInt('tonemap_mode', 0, 4, {
    0: 'LINEAR',
    1: 'REINHARDT',
    2: 'FILMIC',
    3: 'ACES',
    4: 'AGX',
  }),
  tonemap_white: v.nonNegativeFloat('tonemap_white'),
  // AgX's own white reference — a separate property Godot reads INSTEAD of
  // `tonemap_white` under TONE_MAPPER_AGX, so a typo in it is invisible in the
  // other one.
  tonemap_agx_white: v.nonNegativeFloat('tonemap_agx_white'),
  tonemap_agx_contrast: v.nonNegativeFloat('tonemap_agx_contrast'),
  tonemap_exposure: v.nonNegativeFloat('tonemap_exposure'),

  volumetric_fog_enabled: v.boolean('volumetric_fog_enabled'),
  volumetric_fog_density: v.nonNegativeFloat('volumetric_fog_density'),
  volumetric_fog_albedo: v.color('volumetric_fog_albedo'),
  volumetric_fog_emission: v.color('volumetric_fog_emission'),

  adjustment_enabled: v.boolean('adjustment_enabled'),
  adjustment_brightness: v.nonNegativeFloat('adjustment_brightness'),
  adjustment_contrast: v.nonNegativeFloat('adjustment_contrast'),
  adjustment_saturation: v.nonNegativeFloat('adjustment_saturation'),

  ssr_enabled: v.boolean('ssr_enabled'),

  // Glow — every knob the compositor pass reads, so a typo in one is reported
  // rather than silently falling back to a Godot default.
  glow_enabled: v.boolean('glow_enabled'),
  glow_normalized: v.boolean('glow_normalized'),
  glow_intensity: v.nonNegativeFloat('glow_intensity'),
  glow_strength: v.nonNegativeFloat('glow_strength'),
  glow_mix: v.nonNegativeFloat('glow_mix'),
  glow_bloom: v.nonNegativeFloat('glow_bloom'),
  glow_blend_mode: v.enumInt('glow_blend_mode', 0, 4, {
    0: 'ADDITIVE',
    1: 'SCREEN',
    2: 'SOFTLIGHT',
    3: 'REPLACE',
    4: 'MIX',
  }),
  glow_hdr_threshold: v.nonNegativeFloat('glow_hdr_threshold'),
  glow_hdr_scale: v.nonNegativeFloat('glow_hdr_scale'),
  glow_hdr_luminance_cap: v.nonNegativeFloat('glow_hdr_luminance_cap'),
  glow_map_strength: v.nonNegativeFloat('glow_map_strength'),
  // `glow_levels/1`..`glow_levels/7` are seven independent float properties; the
  // registry matches a `prefix/*` pattern, so they need no per-level entries.
  'glow_levels/*': v.nonNegativeFloat('glow_levels'),
});
