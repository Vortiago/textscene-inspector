/**
 * RigidBody2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import '../../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { propertyError } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

const CENTER_OF_MASS_MODE = { 0: 'AUTO', 1: 'CUSTOM' };
const DAMP_MODE = { 0: 'COMBINE', 1: 'REPLACE' };
const FREEZE_MODE = { 0: 'STATIC', 1: 'KINEMATIC' };
const CCD_MODE = { 0: 'DISABLED', 1: 'CAST_RAY', 2: 'CAST_SHAPE' };

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
// rigid_body_2d.cpp:328, ERR_FAIL_COND(p_inertia < 0): the setter refuses.
inertia2d.grounding = { kind: 'enforced', cite: 'rigid_body_2d.cpp:328' };
// Floor only, and the setter is what refuses it. There is no ceiling.
inertia2d.tiers = { min: 'error' };
// rigid_body_2d.cpp:643 hints "0,1000,0.01,or_greater,exp,suffix:kg⋅px²" — the
// `or_greater` opens the max, so only the floor is a bound.
inertia2d.bounds = { min: 0 };

validatorRegistry.registerAll('RigidBody2D', {
  // Two tiers on the floor. rigid_body_2d.cpp:318
  // `ERR_FAIL_COND(p_mass <= 0)` refuses the endpoint too; the hint (:742,
  // "0.001,1000,0.001,or_greater,exp,suffix:kg") states 0.001, so the band
  // between them loads and only warns. `or_greater` leaves the ceiling open.
  mass: v.positiveFloat(
    'mass',
    "Property 'mass' must be greater than 0. Physics bodies require positive mass.",
    { hintedMin: 0.001, enforced: { min: 'rigid_body_2d.cpp:318' }, hinted: { min: 'rigid_body_2d.cpp:742' } }
  ),
  physics_material_override: v.resourceReference('physics_material_override'),
  gravity_scale: v.float('gravity_scale'),
  // rigid_body_2d.cpp:746 "Auto,Custom". set_center_of_mass_mode (:337-358) is a
  // bare assignment, so out-of-range warns.
  center_of_mass_mode: v.enumInt('center_of_mass_mode', 0, 1, CENTER_OF_MASS_MODE, {
    hinted: 'rigid_body_2d.cpp:746',
  }),
  center_of_mass: v.vector2('center_of_mass'),
  inertia: inertia2d,
  sleeping: v.boolean('sleeping'),
  can_sleep: v.boolean('can_sleep'),
  lock_rotation: v.boolean('lock_rotation'),
  freeze: v.boolean('freeze'),
  // rigid_body_2d.cpp:754 "Static,Kinematic". set_freeze_mode (:304-310) is a
  // bare assignment (only an early-return-if-unchanged guard), so out-of-range
  // warns. Godot has this property (unlike its absence suggested before this
  // audit); RigidBody3D carries the same enum.
  freeze_mode: v.enumInt('freeze_mode', 0, 1, FREEZE_MODE, { hinted: 'rigid_body_2d.cpp:754' }),
  custom_integrator: v.boolean('custom_integrator'),
  // rigid_body_2d.cpp:757 "Disabled,Cast Ray,Cast Shape". Unlike RigidBody3D's
  // plain bool, 2D's continuous_cd is an INT enum (CCDMode).
  // set_continuous_collision_detection_mode (:566-569) is a bare assignment,
  // so out-of-range warns.
  continuous_cd: v.enumInt('continuous_cd', 0, 2, CCD_MODE, { hinted: 'rigid_body_2d.cpp:757' }),
  contact_monitor: v.boolean('contact_monitor'),
  // rigid_body_2d.cpp:759 hints "0,64,1,or_greater": floor closed at 0, ceiling
  // open, so 64 is only a slider extent. rigid_body_2d.cpp:501,
  // ERR_FAIL_INDEX_MSG(p_amount, MAX_CONTACTS_REPORTED_2D_MAX) closes both ends
  // instead — the constant is 4096 (servers/physics_2d/physics_server_2d.h:37)
  // and ERR_FAIL_INDEX fails on `p_amount < 0 || p_amount >= p_size`, hence the
  // exclusive ceiling. It sits in `enforcedMax` because the hint states no
  // ceiling for it to narrow.
  max_contacts_reported: v.int('max_contacts_reported', {
    min: 0,
    enforcedMax: { at: 4096, exclusive: true },
    enforced: 'rigid_body_2d.cpp:501',
  }),
  linear_velocity: v.vector2('linear_velocity'),
  // rigid_body_2d.cpp:762 "Combine,Replace". set_linear_damp_mode (:406-409) is
  // a bare assignment, so out-of-range warns.
  linear_damp_mode: v.enumInt('linear_damp_mode', 0, 1, DAMP_MODE, {
    hinted: 'rigid_body_2d.cpp:762',
  }),
  // rigid_body_2d.cpp:425, ERR_FAIL_COND(p_linear_damp < -1). -1 is legal in 2D
  // and means "use the default"; the hint at :763 starts there too.
  linear_damp: v.float('linear_damp', {
    min: -1,
    message: "Property 'linear_damp' must be >= -1. Use -1 for the project default.",
    enforced: 'rigid_body_2d.cpp:425',
  }),
  // rigid_body_2d.cpp:765: Variant::FLOAT. 2D angular velocity is a scalar
  // (rotation around Z), unlike 3D's Vector3. PROPERTY_HINT_NONE;
  // set_angular_velocity (:460-463) is a bare assignment, so no bound.
  angular_velocity: v.float('angular_velocity'),
  // rigid_body_2d.cpp:766 "Combine,Replace". set_angular_damp_mode (:415-418) is
  // a bare assignment, so out-of-range warns.
  angular_damp_mode: v.enumInt('angular_damp_mode', 0, 1, DAMP_MODE, {
    hinted: 'rigid_body_2d.cpp:766',
  }),
  // rigid_body_2d.cpp:435, ERR_FAIL_COND(p_angular_damp < -1); hint :767 starts at -1.
  angular_damp: v.float('angular_damp', {
    min: -1,
    message: "Property 'angular_damp' must be >= -1. Use -1 for the project default.",
    enforced: 'rigid_body_2d.cpp:435',
  }),
  constant_force: v.vector2('constant_force'),
  // rigid_body_2d.cpp:770: Variant::FLOAT. 2D constant_torque is a scalar,
  // unlike 3D's Vector3. set_constant_torque (:558-560) passes straight to
  // the physics server with no guard, so no bound.
  constant_torque: v.float('constant_torque'),
});

// Shown in the generated `## Linting` table of this node's sheet.
inertia2d.accepts = 'float >= 0';
