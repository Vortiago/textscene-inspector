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

/**
 * PI/2 plus `v.radians`' round-trip epsilon (v.ts), so the float32 value
 * Godot's own serialiser writes for the exact boundary does not warn against
 * a bound it produced itself.
 */
const PI_OVER_2 = Math.PI / 2 + 0.0001;

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
  // ERR_FAIL_COND(p_angle <= 0 || p_angle > PI/2) is a REAL closed range in
  // radians (the .tscn's stored unit), tighter than the fully-open hint.
  upper_vertical_angle: v.float('upper_vertical_angle', {
    min: Number.MIN_VALUE,
    max: PI_OVER_2,
    enforced: 'openxr_composition_layer_equirect.cpp:165',
    message: "Property 'upper_vertical_angle' must be greater than 0 and no more than PI/2 radians (~1.5708).",
  }),
  // :79, same hint shape as upper_vertical_angle. set_lower_vertical_angle
  // (:177-184), ERR_FAIL_COND(p_angle <= 0 || p_angle > PI/2) — identical
  // bound, independent property.
  lower_vertical_angle: v.float('lower_vertical_angle', {
    min: Number.MIN_VALUE,
    max: PI_OVER_2,
    enforced: 'openxr_composition_layer_equirect.cpp:177',
    message: "Property 'lower_vertical_angle' must be greater than 0 and no more than PI/2 radians (~1.5708).",
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
