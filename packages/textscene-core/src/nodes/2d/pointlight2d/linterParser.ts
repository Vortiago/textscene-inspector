/**
 * PointLight2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask } from '../../../linter/validators/layerBitmask.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('PointLight2D', {
  // light_2d.cpp:307, ENUM "Add,Subtract,Mix" (BlendMode has no MAX sentinel,
  // but 3 real values match the 3 labels). set_blend_mode
  // (light_2d.cpp:190-192) assigns unconditionally, no ERR_FAIL_INDEX, so out
  // of range is a warning (ADR-0032).
  blend_mode: v.enumInt(
    'blend_mode',
    0,
    2,
    { 0: 'ADD', 1: 'SUB', 2: 'MIX' },
    { hinted: 'light_2d.cpp:190' }
  ),
  color: v.color('color'),
  enabled: v.boolean('enabled'),
  // light_2d.cpp:306 hints "0,16,0.01,or_greater" (or_greater opens the
  // ceiling, so only the 0 floor is checked). set_energy
  // (light_2d.cpp:98-100) assigns unconditionally.
  energy: v.nonNegativeFloat('energy', { hinted: 'light_2d.cpp:98' }),
  offset: v.vector2('offset'),
  // light_2d.cpp:313/320, PROPERTY_HINT_LAYERS_2D_RENDER on both — not a
  // PROPERTY_HINT_RANGE, so there is no numeric hint to ground a bound on.
  // set_item_cull_mask (light_2d.cpp:143-145) and set_item_shadow_cull_mask
  // (light_2d.cpp:152-154) both assign unconditionally, no ERR_FAIL, no
  // clamp. The 0..2^32-1 `layerBitmask` bound these used to carry was never
  // engine-enforced, so it is removed here (ADR-0032 "none").
  range_item_cull_mask: layerBitmask('range_item_cull_mask', { hinted: 'light_2d.cpp:313' }),
  shadow_item_cull_mask: layerBitmask('shadow_item_cull_mask', { hinted: 'light_2d.cpp:320' }),
  // The z and layer windows. Format only, deliberately unbounded: the inspector
  // hints are -4096..4096 and int32, but `Light2D::set_z_range_min` and its
  // siblings only assign and forward — no CLAMP, no reordering — which 4.6.3
  // confirms by keeping -99999. An out-of-hint value is therefore legal input
  // rather than a malformed file. An inverted window is the real authoring
  // mistake, and `linter.ts` warns about it.
  range_z_min: v.int('range_z_min'),
  range_z_max: v.int('range_z_max'),
  range_layer_min: v.int('range_layer_min'),
  range_layer_max: v.int('range_layer_max'),
  shadow_enabled: v.boolean('shadow_enabled'),
  shadow_color: v.color('shadow_color'),
  // light_2d.cpp:318, ENUM 3 labels (matches SHADOW_FILTER_MAX=3,
  // light_2d.h:39-44). set_shadow_filter (light_2d.cpp:170-171)
  // ERR_FAIL_INDEXes against SHADOW_FILTER_MAX.
  shadow_filter: v.enumInt(
    'shadow_filter',
    0,
    2,
    { 0: 'NONE', 1: 'PCF5', 2: 'PCF13' },
    { enforced: 'light_2d.cpp:170' }
  ),
  // light_2d.cpp:319 hints "0,64,0.1" hard both ends; set_shadow_smooth
  // (light_2d.cpp:236-238) assigns unconditionally, so out of range is a
  // warning, not an error (ADR-0032). (Previously cited the inspector's
  // "64 texels" kernel-cap prose rather than the setter — this is the
  // setter-grounded replacement.)
  shadow_filter_smooth: v.float('shadow_filter_smooth', { min: 0, max: 64, hinted: 'light_2d.cpp:319' }),
  texture: v.resourceReference('texture'),
  // light_2d.cpp:479 hints "0.01,50,0.01" hard both ends, but set_texture_scale
  // (light_2d.cpp:441-447) only special-cases an EXACT 0 (bumped to
  // CMP_EPSILON to avoid a zero-scale quad) — any other out-of-range value,
  // including negative, passes through unclamped. So the bound is hint-only,
  // not setter-enforced.
  texture_scale: v.nonNegativeFloat('texture_scale', { hinted: 'light_2d.cpp:441' }),
});
