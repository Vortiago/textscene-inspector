/** CollisionShape3D strict validators for linting. */

// The base chain, so an isolated slice test resolves inherited keys too:
// without it only the full barrel registers Node3D/Node.
import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { debugColorValidator } from '../../shared/debugColor.js';

validatorRegistry.registerAll('CollisionShape3D', {
  shape: v.resourceReference('shape'),
  disabled: v.boolean('disabled'),
  debug_color: debugColorValidator,
  // collision_shape_3d.cpp:186, a plain Variant::BOOL with no hint.
  // set_debug_fill_enabled (:352-361) assigns after a redundant-set guard and
  // forwards to the shape, so there is nothing to bound beyond the format.
  debug_fill: v.boolean('debug_fill'),
});
