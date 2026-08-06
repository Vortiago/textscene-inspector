/**
 * PointLight2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask } from '../../../linter/validators/layerBitmask.js';
import { v, propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

/** 0 is altered (error); anything else outside the hint band only warns. */
const TEXTURE_SCALE_HINT_MIN = 0.01;
const TEXTURE_SCALE_HINT_MAX = 50;

const textureScaleValidator: PropertyValidator = (key, value, line) => {
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) {
    return propertyError(
      key,
      line,
      `Property 'texture_scale' must be a number, got: "${value}"`,
      'INVALID_TEXTURE_SCALE_FORMAT'
    );
  }
  if (parsed === 0) {
    return propertyError(
      key,
      line,
      "Property 'texture_scale' of 0 is replaced with CMP_EPSILON by set_texture_scale (light_2d.cpp:444), so the value in the file is not the one the engine uses",
      'INVALID_TEXTURE_SCALE_VALUE'
    );
  }
  if (parsed < TEXTURE_SCALE_HINT_MIN || parsed > TEXTURE_SCALE_HINT_MAX) {
    return propertyError(
      key,
      line,
      `Property 'texture_scale' must be ${TEXTURE_SCALE_HINT_MIN}-${TEXTURE_SCALE_HINT_MAX} (got ${parsed})`,
      'INVALID_TEXTURE_SCALE_VALUE',
      'warning'
    );
  }
  return null;
};
textureScaleValidator.accepts = `float ${TEXTURE_SCALE_HINT_MIN}-${TEXTURE_SCALE_HINT_MAX}, never exactly 0`;
// The error branch is the stronger claim, so it carries the tag; the warning
// branch cites light_2d.cpp:479 in the comment at its call site.
textureScaleValidator.grounding = { kind: 'enforced', cite: 'light_2d.cpp:444' };

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
    { hinted: 'light_2d.cpp:307' }
  ),
  color: v.color('color'),
  enabled: v.boolean('enabled'),
  // light_2d.cpp:306 hints "0,16,0.01,or_greater" (or_greater opens the
  // ceiling, so only the 0 floor is checked). set_energy
  // (light_2d.cpp:98-100) assigns unconditionally.
  energy: v.nonNegativeFloat('energy', { hinted: 'light_2d.cpp:306' }),
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
  // Two statements with DIFFERENT authority over different values, which no
  // single bound can express, so this one is hand-rolled.
  //
  // Exactly 0 is ALTERED: set_texture_scale bumps it to CMP_EPSILON
  // (light_2d.cpp:444-446) to avoid a zero-scale quad. An altered value is the
  // error tier. Every OTHER out-of-range value, negative included, passes
  // through unclamped, so only the hint "0.01,50,0.01" (light_2d.cpp:479,
  // closed at both ends) excludes it, which is a warning.
  //
  // A plain `min: 0.01, enforced` would error on -5, a value Godot keeps; the
  // earlier `nonNegativeFloat` floored at 0 and so let the one genuinely
  // altered value through clean. Both are wrong in opposite directions.
  texture_scale: textureScaleValidator,
});
