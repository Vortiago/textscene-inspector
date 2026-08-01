/**
 * Generic6DOFJoint3D strict validators for linting.
 *
 * Declare only Generic6DOFJoint3D's OWN members — the ones
 * doc/classes/Generic6DOFJoint3D.xml lists without an `overrides=` attribute.
 * Everything from Joint3D up (`node_a`, `node_b`, `solver_priority`,
 * `exclude_nodes_from_collision`) is registered on the ancestor and delivered
 * by the NODE_BASE_TYPES base-walk, so re-declaring an inherited key shadows
 * it and duplicates the rule.
 *
 * Every member is an axis-indexed `ADD_PROPERTYI` in
 * generic_6dof_joint_3d.cpp's `_bind_methods` (lines 52-164) — `set_param_x/y/z`
 * and `set_flag_x/y/z` keyed by a `Param`/`Flag` enum index, never a runtime
 * `_get_property_list`/`_set`/`_get` override (unlike PhysicalBone3D's
 * `joint_constraints/...`). The full ~80-property set is therefore statically
 * enumerable straight from the ADD_PROPERTYI calls (rule 3), and every one of
 * them carries both a setter and a getter, so none is skipped by rule 4.
 *
 * Six property GROUPS (`linear_limit_`, `linear_motor_`, `linear_spring_`,
 * `angular_limit_`, `angular_motor_`, `angular_spring_`), each duplicated
 * verbatim across the `x`/`y`/`z` axis suffix that is baked into the group
 * name itself rather than living in a separate path segment (contrast
 * PhysicalBone3D's `joint_constraints/<axis>/<leaf>`, where the axis
 * IS a segment). `ValidatorRegistry`'s wildcard support only matches a
 * literal `<prefix>/*`, so the axis has to be part of 18 separate
 * registrations (6 groups × 3 axes) — but every one of Godot's three
 * per-axis `ADD_PROPERTYI` calls for a given leaf uses byte-identical
 * `PropertyInfo` (same hint, same range), so all three axes of a group
 * share ONE leaf-lookup table rather than tripling it.
 */

import '../../joints/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v, accepts, propertyError } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

// generic_6dof_joint_3d.cpp:52-73 — ADD_GROUP("Linear Limit", "linear_limit_"),
// identical PropertyInfo per leaf on the x/y/z ADD_PROPERTYI trio.
const LINEAR_LIMIT_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  enabled: v.boolean('enabled'),
  // upper_distance/lower_distance: PROPERTY_HINT_NONE, "suffix:m" — no
  // PROPERTY_HINT_RANGE at all, so unbounded.
  upper_distance: v.float('upper_distance'),
  lower_distance: v.float('lower_distance'),
  // softness/restitution/damping: PROPERTY_HINT_RANGE "0.01,16,0.01" — no
  // or_less/or_greater, so both ends are the hard bound.
  softness: v.float('softness', { min: 0.01, max: 16 }),
  restitution: v.float('restitution', { min: 0.01, max: 16 }),
  damping: v.float('damping', { min: 0.01, max: 16 }),
};

// generic_6dof_joint_3d.cpp:75-87 — ADD_GROUP("Linear Motor", "linear_motor_").
const LINEAR_MOTOR_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  enabled: v.boolean('enabled'),
  // target_velocity/force_limit: both PROPERTY_HINT_NONE (format-only suffix
  // "m/s" / "kg⋅m/s² (N)") — no PROPERTY_HINT_RANGE, so unbounded.
  target_velocity: v.float('target_velocity'),
  force_limit: v.float('force_limit'),
};

// generic_6dof_joint_3d.cpp:89-104 — ADD_GROUP("Linear Spring", "linear_spring_").
const LINEAR_SPRING_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  enabled: v.boolean('enabled'),
  // stiffness/damping carry no PropertyInfo hint at all: unbounded.
  stiffness: v.float('stiffness'),
  damping: v.float('damping'),
  // equilibrium_point: PROPERTY_HINT_NONE, "suffix:m" — unbounded.
  equilibrium_point: v.float('equilibrium_point'),
};

// generic_6dof_joint_3d.cpp:106-133 — ADD_GROUP("Angular Limit", "angular_limit_").
const ANGULAR_LIMIT_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  enabled: v.boolean('enabled'),
  // upper_angle/lower_angle: PROPERTY_HINT_RANGE "-180,180,0.01,radians_as_degrees"
  // — no or_less/or_greater, so ±180° is the hard bound; the .tscn value is
  // radians, hence the combinator rather than a bare ±180 literal.
  upper_angle: v.radians('upper_angle', { minDeg: -180, maxDeg: 180 }),
  lower_angle: v.radians('lower_angle', { minDeg: -180, maxDeg: 180 }),
  // softness/restitution/damping: PROPERTY_HINT_RANGE "0.01,16,0.01" — hard bound.
  softness: v.float('softness', { min: 0.01, max: 16 }),
  restitution: v.float('restitution', { min: 0.01, max: 16 }),
  damping: v.float('damping', { min: 0.01, max: 16 }),
  // force_limit: PROPERTY_HINT_NONE, "suffix:kg⋅m²/s² (Nm)" — unbounded.
  force_limit: v.float('force_limit'),
  // erp: no hint at all — unbounded.
  erp: v.float('erp'),
};

// generic_6dof_joint_3d.cpp:135-147 — ADD_GROUP("Angular Motor", "angular_motor_").
const ANGULAR_MOTOR_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  enabled: v.boolean('enabled'),
  // target_velocity: PROPERTY_HINT_NONE, "radians_as_degrees,suffix:°/s" — the
  // degrees label is a display hint riding on HINT_NONE, not a
  // PROPERTY_HINT_RANGE, so there is no bound to convert: unbounded.
  target_velocity: v.float('target_velocity'),
  // force_limit: PROPERTY_HINT_NONE, "suffix:kg⋅m²/s² (Nm)" — unbounded.
  force_limit: v.float('force_limit'),
};

// generic_6dof_joint_3d.cpp:149-164 — ADD_GROUP("Angular Spring", "angular_spring_").
const ANGULAR_SPRING_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  enabled: v.boolean('enabled'),
  // stiffness/damping carry no hint at all: unbounded.
  stiffness: v.float('stiffness'),
  damping: v.float('damping'),
  // equilibrium_point: PROPERTY_HINT_RANGE "-180,180,0.01,radians_as_degrees"
  // — same hard ±180° bound as the angular_limit angles, radian-converted.
  equilibrium_point: v.radians('equilibrium_point', { minDeg: -180, maxDeg: 180 }),
};

/** Strips the leading `<group>_<axis>/` segment, leaving the bare leaf name. */
const GROUP_AXIS_PREFIX_RE = /^[^/]+\//;

/**
 * Builds a `<group>_<axis>/*` dispatcher for one property group. The axis
 * letter lives inside the segment this strips, so the same table (and the
 * same dispatcher instance) is registered under all three axis wildcards —
 * Godot's own `ADD_PROPERTYI` calls give x/y/z identical `PropertyInfo` per
 * leaf, so there is nothing axis-specific left to check.
 */
function groupValidator(
  leaves: Readonly<Record<string, PropertyValidator>>,
  groupLabel: string,
  unknownCode: string
): PropertyValidator {
  return accepts((key, value, line) => {
    const leafName = key.replace(GROUP_AXIS_PREFIX_RE, '');
    const leaf = leaves[leafName];
    if (!leaf) {
      return propertyError(key, line, `Unknown ${groupLabel} property: "${key}"`, unknownCode);
    }
    return leaf(key, value, line);
  }, `${groupLabel} parameter (see generic_6dof_joint_3d.cpp _bind_methods)`);
}

const linearLimitValidator = groupValidator(LINEAR_LIMIT_LEAVES, 'linear limit', 'INVALID_LINEAR_LIMIT_KEY');
const linearMotorValidator = groupValidator(LINEAR_MOTOR_LEAVES, 'linear motor', 'INVALID_LINEAR_MOTOR_KEY');
const linearSpringValidator = groupValidator(LINEAR_SPRING_LEAVES, 'linear spring', 'INVALID_LINEAR_SPRING_KEY');
const angularLimitValidator = groupValidator(ANGULAR_LIMIT_LEAVES, 'angular limit', 'INVALID_ANGULAR_LIMIT_KEY');
const angularMotorValidator = groupValidator(ANGULAR_MOTOR_LEAVES, 'angular motor', 'INVALID_ANGULAR_MOTOR_KEY');
const angularSpringValidator = groupValidator(ANGULAR_SPRING_LEAVES, 'angular spring', 'INVALID_ANGULAR_SPRING_KEY');

validatorRegistry.registerAll('Generic6DOFJoint3D', {
  'linear_limit_x/*': linearLimitValidator,
  'linear_limit_y/*': linearLimitValidator,
  'linear_limit_z/*': linearLimitValidator,

  'linear_motor_x/*': linearMotorValidator,
  'linear_motor_y/*': linearMotorValidator,
  'linear_motor_z/*': linearMotorValidator,

  'linear_spring_x/*': linearSpringValidator,
  'linear_spring_y/*': linearSpringValidator,
  'linear_spring_z/*': linearSpringValidator,

  'angular_limit_x/*': angularLimitValidator,
  'angular_limit_y/*': angularLimitValidator,
  'angular_limit_z/*': angularLimitValidator,

  'angular_motor_x/*': angularMotorValidator,
  'angular_motor_y/*': angularMotorValidator,
  'angular_motor_z/*': angularMotorValidator,

  'angular_spring_x/*': angularSpringValidator,
  'angular_spring_y/*': angularSpringValidator,
  'angular_spring_z/*': angularSpringValidator,
});
