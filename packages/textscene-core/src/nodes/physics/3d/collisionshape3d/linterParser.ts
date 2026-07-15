/**
 * CollisionShape3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('CollisionShape3D', {
  shape: v.resourceReference('shape'),
  disabled: v.boolean('disabled'),
});
