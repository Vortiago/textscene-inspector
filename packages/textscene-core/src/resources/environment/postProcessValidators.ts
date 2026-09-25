/**
 * Environment's Tonemap, Glow and Adjustments groups
 * (`environment.cpp:1285-1290`, `:1435-1453`, `:1564-1568`).
 *
 * All hinted: no Environment setter in these groups carries an `ERR_FAIL*` or a
 * clamp, so a value outside a hint loads and runs.
 */

import type { PropertyValidator } from '../../linter/ValidatorRegistry.js';
import { v } from '../../linter/validators/index.js';

export const postProcessKeys: Record<string, PropertyValidator> = {
  // environment.cpp:1286, set_tonemapper (:202-206) bare-assigns.
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
  tonemap_white: v.float('tonemap_white', {
    min: 1,
    message: "Property 'tonemap_white' must be >= 1.",
    hinted: 'environment.cpp:1288',
  }),
  // AgX's own white reference. Godot reads it instead of `tonemap_white` under
  // TONE_MAPPER_AGX, so a typo in it is invisible in the other one.
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
  // environment.cpp:1287 ("0,4,0.01,or_greater")
  tonemap_exposure: v.nonNegativeFloat('tonemap_exposure', { hinted: 'environment.cpp:1287' }),

  // Every knob the compositor pass reads, so a typo in one is reported rather
  // than silently falling back to a Godot default.
  glow_enabled: v.boolean('glow_enabled'),
  glow_normalized: v.boolean('glow_normalized'),
  // environment.cpp:1444-1447, setters (:636, :645, :654, :663) bare-assign.
  // Both ends: none of these four hints carries `or_greater`.
  glow_intensity: v.float('glow_intensity', { min: 0, max: 8, hinted: 'environment.cpp:1444' }),
  glow_strength: v.float('glow_strength', { min: 0, max: 2, hinted: 'environment.cpp:1445' }),
  glow_mix: v.float('glow_mix', { min: 0, max: 1, hinted: 'environment.cpp:1446' }),
  glow_bloom: v.float('glow_bloom', { min: 0, max: 1, hinted: 'environment.cpp:1447' }),
  // environment.cpp:1448, set_glow_blend_mode (:672-676) bare-assigns.
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
  // environment.cpp:1449-1452, setters (:682, :691, :700, :709) bare-assign.
  glow_hdr_threshold: v.float('glow_hdr_threshold', {
    min: 0,
    max: 4,
    hinted: 'environment.cpp:1449',
  }),
  glow_hdr_scale: v.float('glow_hdr_scale', { min: 0, max: 4, hinted: 'environment.cpp:1450' }),
  glow_hdr_luminance_cap: v.float('glow_hdr_luminance_cap', {
    min: 0,
    max: 256,
    hinted: 'environment.cpp:1451',
  }),
  glow_map_strength: v.float('glow_map_strength', {
    min: 0,
    max: 1,
    hinted: 'environment.cpp:1452',
  }),
  glow_map: v.resourceReference('glow_map'),
  // `glow_levels/1`..`glow_levels/7` are independent float properties; the
  // registry matches a `prefix/*` pattern, so they need no per-level entries.
  // set_glow_level (:612-618) ERR_FAIL_INDEXes the LEVEL, but bare-assigns the
  // intensity VALUE this checks.
  'glow_levels/*': v.nonNegativeFloat('glow_levels', { hinted: 'environment.cpp:1436' }),

  adjustment_enabled: v.boolean('adjustment_enabled'),
  // environment.cpp:1565 ("0.0,2.0,0.01,or_greater")
  adjustment_brightness: v.nonNegativeFloat('adjustment_brightness', {
    hinted: 'environment.cpp:1565',
  }),
  // environment.cpp:1566-1567 open both ends (`or_less,or_greater`), so negative
  // contrast and saturation are legal inversions and there is no bound to check.
  adjustment_contrast: v.float('adjustment_contrast'),
  adjustment_saturation: v.float('adjustment_saturation'),
  adjustment_color_correction: v.resourceReference('adjustment_color_correction'),
};
