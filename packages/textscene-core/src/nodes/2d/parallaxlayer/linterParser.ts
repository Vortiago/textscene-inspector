/** ParallaxLayer strict validators for linting. */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node2d/linterParser.js';
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
