/**
 * DirectionalLight2D strict validators for linting.
 *
 * Declare only DirectionalLight2D's OWN members — the ones doc/classes/DirectionalLight2D.xml
 * lists without an `overrides=` attribute. Everything from Light2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../lights/shared/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('DirectionalLight2D', {
  // light_2d.cpp:503 hints "0,1,0.01" — BOTH ends closed, unlike PointLight2D's
  // "0,1024,1,or_greater" hint on the same shared setter. Light2D::set_height
  // (light_2d.cpp:89-92) assigns unconditionally, no clamp, so out of range on
  // either end is a warning (ADR-0032), not an error.
  height: v.float('height', { min: 0, max: 1, hinted: 'light_2d.cpp:503' }),
  // light_2d.cpp:504 hints "0,16384.0,1.0,or_greater,suffix:px" (or_greater
  // opens the ceiling, so only the 0 floor is checked). set_max_distance
  // (light_2d.cpp:490-493) assigns unconditionally.
  max_distance: v.nonNegativeFloat('max_distance', { hinted: 'light_2d.cpp:504' }),
});
