/**
 * RigidBody3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import '../../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const CENTER_OF_MASS_MODE = { 0: 'AUTO', 1: 'CUSTOM' };
const DAMP_MODE = { 0: 'COMBINE', 1: 'REPLACE' };
const FREEZE_MODE = { 0: 'STATIC', 1: 'KINEMATIC' };

validatorRegistry.registerAll('RigidBody3D', {
  // rigid_body_3d.cpp:334, ERR_FAIL_COND(p_mass <= 0): the setter refuses.
  mass: v.float('mass', {
    min: Number.MIN_VALUE,
    message:
      "Property 'mass' must be greater than 0. Physics bodies require positive mass.",
  }),
  physics_material_override: v.resourceReference('physics_material_override'),
  gravity_scale: v.float('gravity_scale'),
  center_of_mass_mode: v.enumInt('center_of_mass_mode', 0, 1, CENTER_OF_MASS_MODE),
  center_of_mass: v.vector3('center_of_mass'),
  // Vector3(0, 0, 0) means "compute automatically", so zero is legal and the
  // bound is only that no component is negative.
  inertia: v.boundedVector3('inertia', { min: 0 }),
  linear_damp_mode: v.enumInt('linear_damp_mode', 0, 1, DAMP_MODE),
  // rigid_body_3d.cpp:444, ERR_FAIL_COND(p_linear_damp < 0.0).
  linear_damp: v.float('linear_damp', {
    min: 0,
    message: "Property 'linear_damp' must be >= 0. Damping cannot be negative.",
  }),
  angular_damp_mode: v.enumInt('angular_damp_mode', 0, 1, DAMP_MODE),
  // rigid_body_3d.cpp:454, ERR_FAIL_COND(p_angular_damp < 0.0).
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
