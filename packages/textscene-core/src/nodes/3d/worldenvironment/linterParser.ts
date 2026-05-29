/**
 * WorldEnvironment strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('WorldEnvironment', {
  environment: v.resourceReference('environment'),
  camera_attributes: v.resourceReference('camera_attributes'),
});
