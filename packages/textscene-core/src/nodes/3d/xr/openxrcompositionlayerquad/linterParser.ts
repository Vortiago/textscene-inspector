/**
 * OpenXRCompositionLayerQuad strict validators for linting.
 *
 * Declare only OpenXRCompositionLayerQuad's OWN members — the ones doc/classes/OpenXRCompositionLayerQuad.xml
 * lists without an `overrides=` attribute. Everything from OpenXRCompositionLayer up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('OpenXRCompositionLayerQuad', {
  // openxr_composition_layer_quad.cpp:61, PROPERTY_HINT_NONE. set_quad_size
  // (:71-77) bare-assigns with no ERR_FAIL and no clamp — format-only.
  quad_size: v.vector2('quad_size'),
});
