/**
 * RigidBody2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../linter/validators/index.js';
import { propertyError } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

const CENTER_OF_MASS_MODE = { 0: 'AUTO', 1: 'CUSTOM' };
const DAMP_MODE = { 0: 'COMBINE', 1: 'REPLACE' };

/** 2D inertia is a scalar (rotational mass around Z), unlike 3D's Vector3. */
const inertia2d: PropertyValidator = (key, value, line) => {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return propertyError(key, line, `Property 'inertia' must be a number, got: "${value}". In 2D, inertia is a scalar value.`, 'INVALID_INERTIA_FORMAT');
  }
  if (num < 0) {
    return propertyError(key, line, `Property 'inertia' must be >= 0, got: ${num}. Use 0 for automatic calculation.`, 'INVALID_INERTIA_VALUE');
  }
  return null;
};

validatorRegistry.registerAll('RigidBody2D', {
  mass: v.float('mass', {
    min: Number.MIN_VALUE,
    message:
      "Property 'mass' must be greater than 0. Physics bodies require positive mass.",
  }),
  physics_material_override: v.resourceReference('physics_material_override'),
  gravity_scale: v.float('gravity_scale'),
  center_of_mass_mode: v.enumInt('center_of_mass_mode', 0, 1, CENTER_OF_MASS_MODE),
  center_of_mass: v.vector2('center_of_mass'),
  inertia: inertia2d,
  linear_damp_mode: v.enumInt('linear_damp_mode', 0, 1, DAMP_MODE),
  linear_damp: v.float('linear_damp', {
    min: 0,
    message: "Property 'linear_damp' must be >= 0. Damping cannot be negative.",
  }),
  angular_damp_mode: v.enumInt('angular_damp_mode', 0, 1, DAMP_MODE),
  angular_damp: v.float('angular_damp', {
    min: 0,
    message: "Property 'angular_damp' must be >= 0. Damping cannot be negative.",
  }),
  collision_layer: layerBitmask('collision_layer'),
  collision_mask: layerBitmask('collision_mask'),
  lock_rotation: v.boolean('lock_rotation'),
  freeze: v.boolean('freeze'),
  contact_monitor: v.boolean('contact_monitor'),
  max_contacts_reported: v.positiveInt('max_contacts_reported'),
});

// Shown in the generated `## Linting` table of this node's sheet.
inertia2d.accepts = 'float >= 0';
