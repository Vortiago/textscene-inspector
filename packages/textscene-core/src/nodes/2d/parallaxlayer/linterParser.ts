/** ParallaxLayer strict validators for linting. */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

// `transform` / `position` and the rest of the Node2D surface arrive through the
// base walk (`NODE_BASE_TYPES`); re-declaring them here is the shadow-copy
// anti-pattern the registry meta-guard rejects.
validatorRegistry.registerAll('ParallaxLayer', {
  motion_scale: v.vector2('motion_scale'),
  motion_offset: v.vector2('motion_offset'),
  motion_mirroring: v.vector2('motion_mirroring'),
});
