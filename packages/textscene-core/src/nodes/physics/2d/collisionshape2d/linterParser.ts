/**
 * CollisionShape2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { debugColorValidator } from '../../shared/debugColor.js';

validatorRegistry.registerAll('CollisionShape2D', {
  shape: v.resourceReference('shape'),
  disabled: v.boolean('disabled'),
  one_way_collision: v.boolean('one_way_collision'),
  // collision_shape_2d.cpp:291, PROPERTY_HINT_RANGE "0,128,0.1,suffix:px".
  // set_one_way_collision_margin (:219-223) is a bare assignment, so
  // out-of-range warns.
  // No `message` override: it would answer for BOTH ends, so a value above 128
  // reported "must be non-negative", which the value satisfies.
  one_way_collision_margin: v.float('one_way_collision_margin', {
    min: 0,
    max: 128,
    hinted: 'collision_shape_2d.cpp:291',
  }),
  debug_color: debugColorValidator,
});
