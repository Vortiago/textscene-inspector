/**
 * OpenXRCompositionLayerEquirect strict validators for linting.
 *
 * Declare only OpenXRCompositionLayerEquirect's OWN members — the ones doc/classes/OpenXRCompositionLayerEquirect.xml
 * lists without an `overrides=` attribute. Everything from OpenXRCompositionLayer up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('OpenXRCompositionLayerEquirect', {
  // openxr_composition_layer_equirect.cpp:76, PROPERTY_HINT_NONE.
  // set_radius (:138-145), ERR_FAIL_COND(p_radius <= 0) — no hint, so the
  // only bound is the enforced floor.
  radius: v.positiveFloat('radius', undefined, {
    enforced: 'openxr_composition_layer_equirect.cpp:139',
  }),
  // :77 hints "0,360,0.1,or_less,or_greater,radians_as_degrees" — both ends
  // open, grounds nothing. set_central_horizontal_angle (:151-158),
  // ERR_FAIL_COND(p_angle <= 0) is the only real bound.
  central_horizontal_angle: v.positiveFloat('central_horizontal_angle', undefined, {
    enforced: 'openxr_composition_layer_equirect.cpp:152',
  }),
  // :78 hints "0,90,0.1,or_less,or_greater,radians_as_degrees" — both ends
  // open, grounds nothing. set_upper_vertical_angle (:164-171),
  // ERR_FAIL_COND(p_angle <= 0 || p_angle > (Math::PI / 2.0)) is a REAL closed
  // range in radians (the .tscn's stored unit), so both ends are the setter's
  // and neither belongs in the hint's `min`/`max` slots. The ceiling is the
  // predicate's own literal: no radian round-trip epsilon, because the bound is
  // stated in radians rather than converted from a degree hint.
  upper_vertical_angle: v.float('upper_vertical_angle', {
    enforcedMin: { at: 0, exclusive: true },
    enforcedMax: { at: Math.PI / 2 },
    enforced: 'openxr_composition_layer_equirect.cpp:165',
  }),
  // :79, same hint shape as upper_vertical_angle. set_lower_vertical_angle
  // (:177-184), ERR_FAIL_COND(p_angle <= 0 || p_angle > (Math::PI / 2.0)) —
  // identical bound, independent property.
  lower_vertical_angle: v.float('lower_vertical_angle', {
    enforcedMin: { at: 0, exclusive: true },
    enforcedMax: { at: Math.PI / 2 },
    enforced: 'openxr_composition_layer_equirect.cpp:178',
  }),
  // :80, PROPERTY_HINT_NONE — so there is no hint tier here at all, and
  // no outer bound to warn about. set_fallback_segments (:190-194) is
  // `ERR_FAIL_COND(p_fallback_segments == 0)`: exactly one value refused.
  //
  // The parameter is uint32_t, so a NEGATIVE literal never reaches that guard —
  // `Variant::operator uint32_t()` (variant.cpp:1511-1513) narrows it first, and
  // -1 is stored as 4294967295. That is the SLOT altering the value, which the
  // declared width already reports; a `min: 1` said "must be >= 1, got: -1",
  // naming a floor the engine does not have and a value it does not store, and
  // it refused `4000000000`, which the unsigned slot holds exactly.
  fallback_segments: v.int('fallback_segments', {
    width: 'uint32',
    enforcedMin: { at: 0, exclusive: true },
    enforced: { min: 'openxr_composition_layer_equirect.cpp:191' },
  }),
});
