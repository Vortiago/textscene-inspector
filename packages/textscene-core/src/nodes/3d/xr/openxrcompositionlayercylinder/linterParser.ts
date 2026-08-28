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
  // ERR_FAIL_COND(p_aspect_ratio <= 0), refuses the floor but never caps the
  // ceiling — 100 is hinted-only. The setter is the STRICTER end here: it
  // excludes 0 while the hint includes it, so nothing reaches the `min: 0`
  // branch and it stands only as the hint's own number. Both are stated
  // because reading one off the other is how a bound drifts.
  aspect_ratio: v.float('aspect_ratio', {
    enforcedMin: { at: 0, exclusive: true },
    min: 0,
    max: 100,
    enforced: { min: 'openxr_composition_layer_cylinder.cpp:144' },
    hinted: 'openxr_composition_layer_cylinder.cpp:73',
  }),
  // :74 hints "0,360,0.1,or_less,or_greater,radians_as_degrees" — both ends
  // open, so the hint grounds nothing. set_central_angle (:156-163),
  // ERR_FAIL_COND(p_central_angle <= 0) is the only real bound, in radians
  // (the stored .tscn unit; radians_as_degrees only affects the inspector).
  central_angle: v.positiveFloat('central_angle', undefined, {
    enforced: 'openxr_composition_layer_cylinder.cpp:157',
  }),
  // :75, PROPERTY_HINT_NONE — so there is no hint tier here at all, and
  // no outer bound to warn about. set_fallback_segments (:169-173) is
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
    enforced: { min: 'openxr_composition_layer_cylinder.cpp:170' },
  }),
});
