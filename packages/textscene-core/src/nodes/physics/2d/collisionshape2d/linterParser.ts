/**
 * CollisionShape2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

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
  one_way_collision_margin: v.float('one_way_collision_margin', {
    min: 0,
    max: 128,
    message:
      "Property 'one_way_collision_margin' must be non-negative (>= 0)",
    hinted: 'collision_shape_2d.cpp:291',
  }),
  debug_color: debugColorValidator,
});
