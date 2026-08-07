/**
 * OpenXRCompositionLayerCylinder strict validators for linting.
 *
 * Declare only OpenXRCompositionLayerCylinder's OWN members — the ones doc/classes/OpenXRCompositionLayerCylinder.xml
 * lists without an `overrides=` attribute. Everything from OpenXRCompositionLayer up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('OpenXRCompositionLayerCylinder', {
  // openxr_composition_layer_cylinder.cpp:72, PROPERTY_HINT_NONE. set_radius
  // (:130-137), ERR_FAIL_COND(p_radius <= 0) — no hint to warn against, so the
  // only bound is the enforced floor.
  radius: v.positiveFloat('radius', undefined, {
    enforced: 'openxr_composition_layer_cylinder.cpp:131',
  }),
  // :73 hints "0,100" closed both ends. set_aspect_ratio (:143-150),
  // ERR_FAIL_COND(p_aspect_ratio <= 0) refuses the floor (stricter than the
  // hint's literal 0), but never caps the ceiling — 100 is hinted-only.
  aspect_ratio: v.float('aspect_ratio', {
    min: Number.MIN_VALUE,
    max: 100,
    enforced: { min: 'openxr_composition_layer_cylinder.cpp:144' },
    hinted: { max: 'openxr_composition_layer_cylinder.cpp:73' },
  }),
  // :74 hints "0,360,0.1,or_less,or_greater,radians_as_degrees" — both ends
  // open, so the hint grounds nothing. set_central_angle (:156-163),
  // ERR_FAIL_COND(p_central_angle <= 0) is the only real bound, in radians
  // (the stored .tscn unit; radians_as_degrees only affects the inspector).
  central_angle: v.positiveFloat('central_angle', undefined, {
    enforced: 'openxr_composition_layer_cylinder.cpp:157',
  }),
  // :75, PROPERTY_HINT_NONE. set_fallback_segments (:169-173),
  // ERR_FAIL_COND(p_fallback_segments == 0) refuses exactly 0. The parameter
  // is uint32_t, so a NEGATIVE .tscn literal does not hit this guard — it
  // wraps to a huge unsigned value instead (Variant::operator uint32_t(),
  // variant.cpp:1511-1513, a plain narrowing cast) and gets used as-is, which
  // is Godot silently ALTERING the value rather than refusing it. Either way
  // the requested segment count is never honoured, so min:1 is the honest
  // floor for what a .tscn value should be, grounded in the same guard.
  fallback_segments: v.int('fallback_segments', {
    min: 1,
    enforced: 'openxr_composition_layer_cylinder.cpp:170',
  }),
});
