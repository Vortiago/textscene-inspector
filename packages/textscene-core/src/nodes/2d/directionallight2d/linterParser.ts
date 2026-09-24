/**
 * DirectionalLight2D strict validators for linting: only its own members, the
 * ones doc/classes/DirectionalLight2D.xml lists without `overrides=`. The
 * NODE_BASE_TYPES base-walk delivers Light2D's, and a re-declared key would shadow it.
 */

import '../lights/shared/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('DirectionalLight2D', {
  // light_2d.cpp:503 hints "0,1,0.01", both ends closed, unlike PointLight2D's
  // "0,1024,1,or_greater" on the same shared setter. Light2D::set_height
  // (light_2d.cpp:89-92) assigns unconditionally, so out of range on either end
  // is a warning (ADR-0032), not an error.
  height: v.float('height', { min: 0, max: 1, hinted: 'light_2d.cpp:503' }),
  // light_2d.cpp:504 hints "0,16384.0,1.0,or_greater,suffix:px" (or_greater
  // opens the ceiling, so only the 0 floor is checked). set_max_distance
  // (light_2d.cpp:490-493) assigns unconditionally.
  max_distance: v.nonNegativeFloat('max_distance', { hinted: 'light_2d.cpp:504' }),
});
