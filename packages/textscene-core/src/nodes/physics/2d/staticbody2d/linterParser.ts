/**
 * StaticBody2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const COLLISION_BITMASK_MSG =
  "Property 'collision_layer' must be between 0 and 1048575. Valid range: 20-bit bitmask";
const COLLISION_MASK_MSG =
  "Property 'collision_mask' must be between 0 and 1048575. Valid range: 20-bit bitmask";

validatorRegistry.registerAll('StaticBody2D', {
  physics_material_override: v.resourceReference('physics_material_override'),
  constant_linear_velocity: v.vector2('constant_linear_velocity'),
  constant_angular_velocity: v.float('constant_angular_velocity'),
  collision_layer: v.int('collision_layer', {
    min: 0,
    max: 1048575,
    message: COLLISION_BITMASK_MSG,
  }),
  collision_mask: v.int('collision_mask', {
    min: 0,
    max: 1048575,
    message: COLLISION_MASK_MSG,
  }),
  collision_priority: v.float('collision_priority'),
  input_pickable: v.boolean('input_pickable'),
});
