/**
 * OpenXRCompositionLayerQuad strict validators for its own members, the ones doc/classes/OpenXRCompositionLayerQuad.xml lists
 * without `overrides=`. Keys from OpenXRCompositionLayer up arrive through the NODE_BASE_TYPES base-walk, so
 * re-declaring one would shadow the ancestor's rule.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('OpenXRCompositionLayerQuad', {
  // openxr_composition_layer_quad.cpp:61, PROPERTY_HINT_NONE. set_quad_size
  // (:71-77) bare-assigns with no ERR_FAIL and no clamp, so the check is format only.
  quad_size: v.vector2('quad_size'),
});
