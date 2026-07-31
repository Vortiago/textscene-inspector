/**
 * RigidBody3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `inertia` keeps a bespoke validator because RigidBody3D inertia is a
 * Vector3 (per-axis) and the per-node test asserts that each component
 * must be non-negative.
 */

import '../../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import {
  v,
  VECTOR3_REGEX,
} from '../../../../linter/validators/index.js';
import { propertyError } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

const CENTER_OF_MASS_MODE = { 0: 'AUTO', 1: 'CUSTOM' };
const DAMP_MODE = { 0: 'COMBINE', 1: 'REPLACE' };
const FREEZE_MODE = { 0: 'STATIC', 1: 'KINEMATIC' };
const inertia3d: PropertyValidator = (key, value, line) => {
  const match = VECTOR3_REGEX.exec(value);
  if (!match) {
    return propertyError(key, line, `Property 'inertia' must be Vector3 with 3 numbers like Vector3(0, 0, 0), got: "${value}"`, 'INVALID_INERTIA_FORMAT');
  }
  const x = parseFloat(match[1] || '0');
  const y = parseFloat(match[2] || '0');
  const z = parseFloat(match[3] || '0');
  if (x < 0 || y < 0 || z < 0) {
    return propertyError(key, line, `Property 'inertia' components must be >= 0, got: Vector3(${x}, ${y}, ${z}). Use Vector3(0, 0, 0) for automatic calculation.`, 'INVALID_INERTIA_VALUE');
  }
  return null;
};

validatorRegistry.registerAll('RigidBody3D', {
  mass: v.float('mass', {
    min: Number.MIN_VALUE,
    message:
      "Property 'mass' must be greater than 0. Physics bodies require positive mass.",
  }),
  physics_material_override: v.resourceReference('physics_material_override'),
  gravity_scale: v.float('gravity_scale'),
  center_of_mass_mode: v.enumInt('center_of_mass_mode', 0, 1, CENTER_OF_MASS_MODE),
  center_of_mass: v.vector3('center_of_mass'),
  inertia: inertia3d,
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
  lock_rotation: v.boolean('lock_rotation'),
  freeze_mode: v.enumInt('freeze_mode', 0, 1, FREEZE_MODE),
  freeze: v.boolean('freeze'),
  continuous_cd: v.boolean('continuous_cd'),
  contact_monitor: v.boolean('contact_monitor'),
  max_contacts_reported: v.positiveInt('max_contacts_reported'),
  can_sleep: v.boolean('can_sleep'),
  sleeping: v.boolean('sleeping'),
  custom_integrator: v.boolean('custom_integrator'),
});

// Shown in the generated `## Linting` table of this node's sheet.
inertia3d.accepts = 'Vector3(x, y, z), all >= 0';
