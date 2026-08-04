/**
 * Environment property validation, entirely through the shared `v` combinators.
 *
 * Every entry names its own property, so each emits an `INVALID_<PROPERTY>_FORMAT`
 * or `_VALUE` code rather than one generic code shared across unrelated properties,
 * and the enum entries name Godot's own constants in the message instead of printing
 * a bare numeric range.
 *
 * Every bounded entry below is a bare assignment in `scene/resources/environment.cpp`
 * (ADR-0032 `hinted`, not `enforced`): Environment's setters carry no `ERR_FAIL*` on
 * any of these, so a value the ADD_PROPERTY hint would not offer in the inspector
 * still loads and runs. `adjustment_contrast`/`adjustment_saturation` carry no bound
 * at all: their hints open BOTH ends (`or_less,or_greater`), so negative values are
 * legal (e.g. inverted contrast) and a floor here was a live false positive.
 */

import { validatorRegistry } from '../../linter/ValidatorRegistry';
import { v } from '../../linter/validators/index.js';

// Register validators for Environment properties
validatorRegistry.registerAll('Environment', {
  // environment.cpp:1237, set_background (:43-49) is a bare assignment.
  background_mode: v.enumInt(
    'background_mode',
    0,
    5,
    {
      0: 'BG_CLEAR_COLOR',
      1: 'BG_COLOR',
      2: 'BG_SKY',
      3: 'BG_CANVAS',
      4: 'BG_KEEP',
      5: 'BG_CAMERA_FEED',
    },
    { hinted: 'environment.cpp:1237' }
  ),
  background_color: v.color('background_color'),
  // environment.cpp:1239 ("0,16,0.01"), set_bg_energy_multiplier (:96-99) bare assigns.
  background_energy_multiplier: v.nonNegativeFloat('background_energy_multiplier', {
    hinted: 'environment.cpp:1239',
  }),
  sky: v.resourceReference('sky'),

  // Ambient lighting — read by the render parser, so lint it too (parity).
  // environment.cpp:1264, set_ambient_source (:151-155) is a bare assignment.
  ambient_light_source: v.enumInt(
    'ambient_light_source',
    0,
    3,
    {
      0: 'BG',
      1: 'DISABLED',
      2: 'COLOR',
      3: 'SKY',
    },
    { hinted: 'environment.cpp:1264' }
  ),
  ambient_light_color: v.color('ambient_light_color'),
  // environment.cpp:1267 ("0,16,0.01"), set_ambient_light_energy (:161-164) bare assigns.
  ambient_light_energy: v.nonNegativeFloat('ambient_light_energy', {
    hinted: 'environment.cpp:1267',
  }),

  // Screen-space fog — read by the render parser (feeds the scene fog), so lint it.
  fog_enabled: v.boolean('fog_enabled'),
  // environment.cpp:1497 ("0,1,0.0001,or_greater"), set_fog_density (:814-817) bare assigns.
  fog_density: v.nonNegativeFloat('fog_density', { hinted: 'environment.cpp:1497' }),
  fog_light_color: v.color('fog_light_color'),
  // environment.cpp:1492, set_fog_mode (:778-786) is a bare assignment.
  fog_mode: v.enumInt(
    'fog_mode',
    0,
    1,
    { 0: 'EXPONENTIAL', 1: 'DEPTH' },
    { hinted: 'environment.cpp:1492' }
  ),

  // Tonemapping — parsed but not yet rendered; validate so it isn't silently ignored.
  // environment.cpp:1286, set_tonemapper (:202-206) is a bare assignment.
  tonemap_mode: v.enumInt(
    'tonemap_mode',
    0,
    4,
    {
      0: 'LINEAR',
      1: 'REINHARDT',
      2: 'FILMIC',
      3: 'ACES',
      4: 'AGX',
    },
    { hinted: 'environment.cpp:1286' }
  ),
  // environment.cpp:1288 hints "1,16,0.01,or_greater": the real floor is 1, not 0.
  // set_tonemap_white (:221-224) is a bare assignment.
  tonemap_white: v.float('tonemap_white', {
    min: 1,
    message: "Property 'tonemap_white' must be >= 1.",
    hinted: 'environment.cpp:1288',
  }),
  // AgX's own white reference — a separate property Godot reads INSTEAD of
  // `tonemap_white` under TONE_MAPPER_AGX, so a typo in it is invisible in the
  // other one. environment.cpp:1289 hints "2,16.5,0.01,or_greater": floor is 2.
  tonemap_agx_white: v.float('tonemap_agx_white', {
    min: 2,
    message: "Property 'tonemap_agx_white' must be >= 2.",
    hinted: 'environment.cpp:1289',
  }),
  // environment.cpp:1290 hints "1.0,2.0,0.01,or_greater": floor is 1.0, not 0.
  tonemap_agx_contrast: v.float('tonemap_agx_contrast', {
    min: 1.0,
    message: "Property 'tonemap_agx_contrast' must be >= 1.0.",
    hinted: 'environment.cpp:1290',
  }),
  // environment.cpp:1287 ("0,4,0.01,or_greater"), set_tonemap_exposure (:212-215) bare assigns.
  tonemap_exposure: v.nonNegativeFloat('tonemap_exposure', { hinted: 'environment.cpp:1287' }),

  volumetric_fog_enabled: v.boolean('volumetric_fog_enabled'),
  // environment.cpp:1536 ("0,1,0.0001,or_greater"), set_volumetric_fog_density
  // (:939-942) bare assigns.
  volumetric_fog_density: v.nonNegativeFloat('volumetric_fog_density', {
    hinted: 'environment.cpp:1536',
  }),
  volumetric_fog_albedo: v.color('volumetric_fog_albedo'),
  volumetric_fog_emission: v.color('volumetric_fog_emission'),

  adjustment_enabled: v.boolean('adjustment_enabled'),
  // environment.cpp:1565 ("0.0,2.0,0.01,or_greater"), set_adjustment_brightness
  // (:1041-1044) bare assigns.
  adjustment_brightness: v.nonNegativeFloat('adjustment_brightness', {
    hinted: 'environment.cpp:1565',
  }),
  // environment.cpp:1566 hints "0.75,1.25,0.005,or_less,or_greater": BOTH ends
  // open, so negative contrast is legal (e.g. an inverted look); no bound to check.
  adjustment_contrast: v.float('adjustment_contrast'),
  // environment.cpp:1567 hints "0.0,2.0,0.01,or_less,or_greater": BOTH ends open,
  // so negative saturation is legal; no bound to check.
  adjustment_saturation: v.float('adjustment_saturation'),

  ssr_enabled: v.boolean('ssr_enabled'),

  // Glow — every knob the compositor pass reads, so a typo in one is reported
  // rather than silently falling back to a Godot default.
  glow_enabled: v.boolean('glow_enabled'),
  glow_normalized: v.boolean('glow_normalized'),
  // environment.cpp:1444 ("0.0,8.0,0.01"), set_glow_intensity (:636-639) bare assigns.
  glow_intensity: v.nonNegativeFloat('glow_intensity', { hinted: 'environment.cpp:1444' }),
  // environment.cpp:1445 ("0.0,2.0,0.01"), set_glow_strength (:645-648) bare assigns.
  glow_strength: v.nonNegativeFloat('glow_strength', { hinted: 'environment.cpp:1445' }),
  // environment.cpp:1446 ("0.0,1.0,0.001"), set_glow_mix (:654-657) bare assigns.
  glow_mix: v.nonNegativeFloat('glow_mix', { hinted: 'environment.cpp:1446' }),
  // environment.cpp:1447 ("0.0,1.0,0.01"), set_glow_bloom (:663-666) bare assigns.
  glow_bloom: v.nonNegativeFloat('glow_bloom', { hinted: 'environment.cpp:1447' }),
  // environment.cpp:1448, set_glow_blend_mode (:672-676) is a bare assignment.
  glow_blend_mode: v.enumInt(
    'glow_blend_mode',
    0,
    4,
    {
      0: 'ADDITIVE',
      1: 'SCREEN',
      2: 'SOFTLIGHT',
      3: 'REPLACE',
      4: 'MIX',
    },
    { hinted: 'environment.cpp:1448' }
  ),
  // environment.cpp:1449 ("0.0,4.0,0.01"), set_glow_hdr_bleed_threshold (:682-685) bare assigns.
  glow_hdr_threshold: v.nonNegativeFloat('glow_hdr_threshold', { hinted: 'environment.cpp:1449' }),
  // environment.cpp:1450 ("0.0,4.0,0.01"), set_glow_hdr_bleed_scale (:691-694) bare assigns.
  glow_hdr_scale: v.nonNegativeFloat('glow_hdr_scale', { hinted: 'environment.cpp:1450' }),
  // environment.cpp:1451 ("0.0,256.0,0.01"), set_glow_hdr_luminance_cap (:700-703) bare assigns.
  glow_hdr_luminance_cap: v.nonNegativeFloat('glow_hdr_luminance_cap', {
    hinted: 'environment.cpp:1451',
  }),
  // environment.cpp:1452 ("0.0,1.0,0.01"), set_glow_map_strength (:709-712) bare assigns.
  glow_map_strength: v.nonNegativeFloat('glow_map_strength', { hinted: 'environment.cpp:1452' }),
  // `glow_levels/1`..`glow_levels/7` are seven independent float properties; the
  // registry matches a `prefix/*` pattern, so they need no per-level entries.
  // environment.cpp:1436-1442 ("0,16,0.01,or_greater"); set_glow_level (:612-618)
  // ERR_FAIL_INDEXes the LEVEL, but bare-assigns the intensity VALUE this checks.
  'glow_levels/*': v.nonNegativeFloat('glow_levels', { hinted: 'environment.cpp:1436' }),
});
