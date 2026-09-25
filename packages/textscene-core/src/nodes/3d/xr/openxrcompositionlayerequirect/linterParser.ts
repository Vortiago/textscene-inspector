/**
 * OpenXRCompositionLayerEquirect strict validators for its own members, the ones doc/classes/OpenXRCompositionLayerEquirect.xml lists
 * without `overrides=`. Keys from OpenXRCompositionLayer up arrive through the NODE_BASE_TYPES base-walk, so
 * re-declaring one would shadow the ancestor's rule.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('OpenXRCompositionLayerEquirect', {
  // openxr_composition_layer_equirect.cpp:76, PROPERTY_HINT_NONE.
  // set_radius (:138-145), ERR_FAIL_COND(p_radius <= 0). With no hint, the
  // only bound is the enforced floor.
  radius: v.positiveFloat('radius', undefined, {
    enforced: 'openxr_composition_layer_equirect.cpp:139',
  }),
  // :77 hints "0,360,0.1,or_less,or_greater,radians_as_degrees", both ends
  // open, so it grounds nothing. set_central_horizontal_angle (:151-158),
  // ERR_FAIL_COND(p_angle <= 0) is the only real bound.
  central_horizontal_angle: v.positiveFloat('central_horizontal_angle', undefined, {
    enforced: 'openxr_composition_layer_equirect.cpp:152',
  }),
  // :78 hints "0,90,0.1,or_less,or_greater,radians_as_degrees", both ends open. set_upper_vertical_angle
  // (:164-171), ERR_FAIL_COND(p_angle <= 0 || p_angle > (Math::PI / 2.0)), is a closed range in
  // radians, the stored unit, so both ends are the setter's. The ceiling is the predicate's own
  // literal, with no round-trip epsilon, since no degree hint is converted.
  upper_vertical_angle: v.float('upper_vertical_angle', {
    enforcedMin: { at: 0, exclusive: true },
    enforcedMax: { at: Math.PI / 2 },
    enforced: 'openxr_composition_layer_equirect.cpp:165',
  }),
  // :79, same hint shape as upper_vertical_angle. set_lower_vertical_angle
  // (:177-184), ERR_FAIL_COND(p_angle <= 0 || p_angle > (Math::PI / 2.0)):
  // the same bound on an independent property.
  lower_vertical_angle: v.float('lower_vertical_angle', {
    enforcedMin: { at: 0, exclusive: true },
    enforcedMax: { at: Math.PI / 2 },
    enforced: 'openxr_composition_layer_equirect.cpp:178',
  }),
  // :80, PROPERTY_HINT_NONE, so there is no hint tier and no outer bound. set_fallback_segments
  // (:190-194) is `ERR_FAIL_COND(p_fallback_segments == 0)`: exactly one value refused.
  fallback_segments: v.int('fallback_segments', {
    // The parameter is uint32_t: `Variant::operator uint32_t()` (variant.cpp:1511-1513) stores -1 as
    // 4294967295 before the guard, and the declared width reports that. A `min: 1` would name a floor
    // the engine does not have and refuse `4000000000`, which the unsigned slot holds exactly.
    width: 'uint32',
    enforcedMin: { at: 0, exclusive: true },
    enforced: { min: 'openxr_composition_layer_equirect.cpp:191' },
  }),
});
