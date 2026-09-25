/** ParallaxLayer strict validators for linting. */

// Registration happens on import, so a test that loads only this slice
// resolves an inherited key only when this line imports the ancestor.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

// The Node2D surface arrives through the base walk (`NODE_BASE_TYPES`). The
// registry meta-guard rejects a re-declared, shadowing copy.
validatorRegistry.registerAll('ParallaxLayer', {
  motion_scale: v.vector2('motion_scale'),
  motion_offset: v.vector2('motion_offset'),
  motion_mirroring: v.vector2('motion_mirroring'),
});
