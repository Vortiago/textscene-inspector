/**
 * Validators shared by every Light2D-derived node.
 *
 * Registered under the abstract key 'Light2D', which Godot cannot
 * instantiate, so it appears in no .tscn and owns no slice. It reaches its
 * 2 subclasses through the
 * NODE_BASE_TYPES base-walk.
 *
 * Declare only Light2D's OWN members: the ones doc/classes/Light2D.xml
 * lists without an `overrides=` attribute, cross-checked against ADD_PROPERTY
 * in the .cpp. Quote the governing source line beside every non-obvious bound.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { layerBitmask } from '../../../../linter/validators/layerBitmask.js';
import { v } from '../../../../linter/validators/index.js';
import { CANVAS_ITEM_Z_MIN, CANVAS_ITEM_Z_MAX } from '../../../../godot/rendering.js';

validatorRegistry.registerAll('Light2D', {
  enabled: v.boolean('enabled'),
  editor_only: v.boolean('editor_only'),
  color: v.color('color'),
  // light_2d.cpp:306 hints "0,16,0.01,or_greater" (or_greater opens the
  // ceiling, so only the 0 floor is checked). set_energy
  // (light_2d.cpp:98-100) assigns unconditionally.
  energy: v.nonNegativeFloat('energy', { hinted: 'light_2d.cpp:306' }),
  // light_2d.cpp:307, ENUM "Add,Subtract,Mix" (BlendMode has no MAX sentinel,
  // but 3 real values match the 3 labels). set_blend_mode
  // (light_2d.cpp:190-192) assigns unconditionally, no ERR_FAIL_INDEX, so out
  // of range is a warning (ADR-0032).
  blend_mode: v.enumInt(
    'blend_mode',
    0,
    2,
    { 0: 'ADD', 1: 'SUB', 2: 'MIX' },
    { hinted: 'light_2d.cpp:307' }
  ),
  // light_2d.cpp:309-310 hints the closed range CANVAS_ITEM_Z_MIN..MAX (neither
  // or_greater nor or_less). `Light2D::set_z_range_min`/`_max` only assign and
  // forward, no CLAMP, no reordering, which 4.6.3 confirms by keeping -99999 —
  // so a hinted-but-unenforced closed bound is a warning under ADR-0032, not
  // silence.
  range_z_min: v.int('range_z_min', { min: CANVAS_ITEM_Z_MIN, max: CANVAS_ITEM_Z_MAX, hinted: 'light_2d.cpp:309' }),
  range_z_max: v.int('range_z_max', { min: CANVAS_ITEM_Z_MIN, max: CANVAS_ITEM_Z_MAX, hinted: 'light_2d.cpp:310' }),
  // light_2d.cpp:311-312 hints CANVAS_LAYER_MIN..MAX, which is int32's own
  // span (see the constant's docblock): the hint excludes nothing an int
  // property can legally hold, so this stays format-only rather than carrying
  // a bound that can never fire.
  range_layer_min: v.int('range_layer_min'),
  range_layer_max: v.int('range_layer_max'),
  // light_2d.cpp:313/320, PROPERTY_HINT_LAYERS_2D_RENDER on both — not a
  // PROPERTY_HINT_RANGE, so there is no numeric hint to ground a bound on.
  // set_item_cull_mask (light_2d.cpp:143-145) and set_item_shadow_cull_mask
  // (light_2d.cpp:152-154) both assign unconditionally, no ERR_FAIL, no
  // clamp. The 0..2^32-1 `layerBitmask` bound these used to carry was never
  // engine-enforced, so it is removed here (ADR-0032 "none").
  range_item_cull_mask: layerBitmask('range_item_cull_mask', { hinted: 'light_2d.cpp:313' }),
  shadow_item_cull_mask: layerBitmask('shadow_item_cull_mask', { hinted: 'light_2d.cpp:320' }),
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
  // warning, not an error (ADR-0032).
  shadow_filter_smooth: v.float('shadow_filter_smooth', { min: 0, max: 64, hinted: 'light_2d.cpp:319' }),
});
