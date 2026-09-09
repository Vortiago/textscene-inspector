/**
 * RigidBody3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const CENTER_OF_MASS_MODE = { 0: 'AUTO', 1: 'CUSTOM' };
const DAMP_MODE = { 0: 'COMBINE', 1: 'REPLACE' };
const FREEZE_MODE = { 0: 'STATIC', 1: 'KINEMATIC' };

validatorRegistry.registerAll('RigidBody3D', {
  // Two tiers on the floor. rigid_body_3d.cpp:334
  // `ERR_FAIL_COND(p_mass <= 0)` refuses the endpoint too; the hint (:764,
  // "0.001,1000,0.001,or_greater,exp,suffix:kg") states 0.001, so the band
  // between them loads and only warns. `or_greater` leaves the ceiling open.
  mass: v.positiveFloat(
    'mass',
    "Property 'mass' must be greater than 0. Physics bodies require positive mass.",
    { min: 0.001, enforced: { min: 'rigid_body_3d.cpp:334' }, hinted: { min: 'rigid_body_3d.cpp:764' } }
  ),
  physics_material_override: v.resourceReference('physics_material_override'),
  gravity_scale: v.float('gravity_scale'),
  // rigid_body_3d.cpp:768 "Auto,Custom". set_center_of_mass_mode (:356-377) is a
  // bare assignment, so out-of-range warns.
  center_of_mass_mode: v.enumInt('center_of_mass_mode', 0, 1, CENTER_OF_MASS_MODE, {
    hinted: 'rigid_body_3d.cpp:768',
  }),
  center_of_mass: v.vector3('center_of_mass'),
  // Vector3(0, 0, 0) means "compute automatically", so zero is legal and the
  // bound is only that no component is negative. rigid_body_3d.cpp:344-346,
  // three ERR_FAIL_COND(p_inertia.{x,y,z} < 0): the setter refuses.
  inertia: v.boundedVector3('inertia', { min: 0, enforced: 'rigid_body_3d.cpp:344' }),
  linear_velocity: v.vector3('linear_velocity'),
  // rigid_body_3d.cpp:784 "Combine,Replace". set_linear_damp_mode (:425-428) is
  // a bare assignment, so out-of-range warns.
  linear_damp_mode: v.enumInt('linear_damp_mode', 0, 1, DAMP_MODE, {
    hinted: 'rigid_body_3d.cpp:784',
  }),
  // rigid_body_3d.cpp:444, ERR_FAIL_COND(p_linear_damp < 0.0).
  linear_damp: v.float('linear_damp', {
    min: 0,
    message: "Property 'linear_damp' must be >= 0. Damping cannot be negative.",
    enforced: 'rigid_body_3d.cpp:444',
  }),
  // rigid_body_3d.cpp:787: Variant::VECTOR3. 3D angular velocity is a vector,
  // unlike RigidBody2D's scalar. PROPERTY_HINT_NONE; set_angular_velocity
  // (:479-482) is a bare assignment, so no bound.
  angular_velocity: v.vector3('angular_velocity'),
  // rigid_body_3d.cpp:788 "Combine,Replace". set_angular_damp_mode (:434-437) is
  // a bare assignment, so out-of-range warns.
  angular_damp_mode: v.enumInt('angular_damp_mode', 0, 1, DAMP_MODE, {
    hinted: 'rigid_body_3d.cpp:788',
  }),
  // rigid_body_3d.cpp:454, ERR_FAIL_COND(p_angular_damp < 0.0).
  angular_damp: v.float('angular_damp', {
    min: 0,
    message: "Property 'angular_damp' must be >= 0. Damping cannot be negative.",
    enforced: 'rigid_body_3d.cpp:454',
  }),
  constant_force: v.vector3('constant_force'),
  // rigid_body_3d.cpp:792: Variant::VECTOR3. 3D constant_torque is a vector,
  // unlike RigidBody2D's scalar. set_constant_torque (:584-586) passes
  // straight to the physics server with no guard, so no bound.
  constant_torque: v.vector3('constant_torque'),
  lock_rotation: v.boolean('lock_rotation'),
  // rigid_body_3d.cpp:776 "Static,Kinematic". set_freeze_mode (:320-326) is a
  // bare assignment (only an early-return-if-unchanged guard), so out-of-range
  // warns.
  freeze_mode: v.enumInt('freeze_mode', 0, 1, FREEZE_MODE, { hinted: 'rigid_body_3d.cpp:776' }),
  freeze: v.boolean('freeze'),
  continuous_cd: v.boolean('continuous_cd'),
  contact_monitor: v.boolean('contact_monitor'),
  // rigid_body_3d.cpp:781 hints "0,64,1,or_greater": floor closed at 0, ceiling
  // open, so 64 is only a slider extent. rigid_body_3d.cpp:524,
  // ERR_FAIL_INDEX_MSG(p_amount, MAX_CONTACTS_REPORTED_3D_MAX) closes both ends
  // instead — the constant is 4096 (servers/physics_3d/physics_server_3d.h:36)
  // and ERR_FAIL_INDEX fails on `p_amount < 0 || p_amount >= p_size`, hence the
  // exclusive ceiling. It sits in `enforcedMax` because the hint states no
  // ceiling for it to narrow.
  max_contacts_reported: v.int('max_contacts_reported', {
    min: 0,
    enforcedMax: { at: 4096, exclusive: true },
    enforced: 'rigid_body_3d.cpp:524',
  }),
  can_sleep: v.boolean('can_sleep'),
  sleeping: v.boolean('sleeping'),
  custom_integrator: v.boolean('custom_integrator'),
});
