/**
 * StaticBody3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../linter/validators/index.js';

const DISABLE_MODE = { 0: 'REMOVE', 1: 'MAKE_STATIC', 2: 'KEEP_ACTIVE' };

validatorRegistry.registerAll('StaticBody3D', {
  physics_material_override: v.resourceReference('physics_material_override'),
  constant_linear_velocity: v.vector3('constant_linear_velocity'),
  constant_angular_velocity: v.vector3('constant_angular_velocity'),
  collision_layer: layerBitmask('collision_layer'),
  collision_mask: layerBitmask('collision_mask'),
  collision_priority: v.float('collision_priority'),
  disable_mode: v.enumInt('disable_mode', 0, 2, DISABLE_MODE),
  input_ray_pickable: v.boolean('input_ray_pickable'),
  input_capture_on_drag: v.boolean('input_capture_on_drag'),
});
