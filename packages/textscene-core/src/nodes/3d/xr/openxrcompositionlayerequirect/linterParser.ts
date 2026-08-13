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
  // :80, PROPERTY_HINT_NONE. set_fallback_segments (:190-194),
  // ERR_FAIL_COND(p_fallback_segments == 0) — same uint32_t shape as
  // OpenXRCompositionLayerCylinder's own fallback_segments (see that file's
  // comment): a negative literal wraps rather than tripping this guard, but
  // never produces the requested count either, so min:1 is the honest floor.
  fallback_segments: v.int('fallback_segments', {
    min: 1,
    enforced: 'openxr_composition_layer_equirect.cpp:191',
  }),
});
