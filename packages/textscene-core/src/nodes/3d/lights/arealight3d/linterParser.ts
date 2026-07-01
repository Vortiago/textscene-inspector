/**
 * AreaLight3D strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { SHARED_LIGHT_VALIDATORS } from '../shared/linterParser.js';

validatorRegistry.registerAll('AreaLight3D', {
  ...SHARED_LIGHT_VALIDATORS,
  area_range: v.positiveFloat('area_range'),
  area_size: v.vector2('area_size'),
});
