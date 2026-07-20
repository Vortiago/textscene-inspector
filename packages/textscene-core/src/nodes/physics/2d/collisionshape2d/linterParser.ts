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
  one_way_collision_margin: v.float('one_way_collision_margin', {
    min: 0,
    message:
      "Property 'one_way_collision_margin' must be non-negative (>= 0)",
  }),
  debug_color: debugColorValidator,
});
