/**
 * StaticBody3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import '../../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('StaticBody3D', {
  physics_material_override: v.resourceReference('physics_material_override'),
  constant_linear_velocity: v.vector3('constant_linear_velocity'),
  constant_angular_velocity: v.vector3('constant_angular_velocity'),
});
