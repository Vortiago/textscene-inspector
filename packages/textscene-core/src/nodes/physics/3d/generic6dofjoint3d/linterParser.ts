/**
 * Generic6DOFJoint3D strict validators: only the members doc/classes/Generic6DOFJoint3D.xml lists
 * without `overrides=`. The NODE_BASE_TYPES base-walk delivers everything from Joint3D up, and a
 * re-declared key shadows it. Every member is an axis-indexed `ADD_PROPERTYI` with a setter and a
 * getter in generic_6dof_joint_3d.cpp's `_bind_methods` (lines 52-164), never a property-list override.
 */

import '../../joints/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { accepts, keyShapeError, v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

/**
 * One group's leaves, built for the `<group>_<axis>` prefix its keys carry: `linear_limit_y`
 * gives `linear_limit_y/softness`. The three axes share one hint per leaf, but a function, not a
 * constant, since `v.float` quotes the name it is handed in the message and derives the
 * `formatCode`/`valueCode` codes from it, so each axis names the key the file wrote.
 */
type LeafTable = (groupPrefix: string) => Readonly<Record<string, PropertyValidator>>;

// generic_6dof_joint_3d.cpp:52-73: ADD_GROUP("Linear Limit", "linear_limit_"), one PropertyInfo
// per leaf across the x/y/z trio. set_param_x/y/z opens with `ERR_FAIL_INDEX(p_param, PARAM_MAX)`
// (:200, :215, :229), a guard on the index only, then assigns p_value straight through
// (:201, :216, :230), so every bound below is hinted.
const linearLimitLeaves: LeafTable = (g) => ({
  enabled: v.boolean(`${g}/enabled`),
  // upper_distance/lower_distance: PROPERTY_HINT_NONE, "suffix:m", no
  // PROPERTY_HINT_RANGE at all, so unbounded.
  upper_distance: v.float(`${g}/upper_distance`),
  lower_distance: v.float(`${g}/lower_distance`),
  // softness/restitution/damping: PROPERTY_HINT_RANGE "0.01,16,0.01", closed at
  // both ends (:57-59). set_param_x/y/z assigns the value unaltered, so hinted.
  softness: v.float(`${g}/softness`, {
    min: 0.01,
    max: 16,
    hinted: 'generic_6dof_joint_3d.cpp:57',
  }),
  restitution: v.float(`${g}/restitution`, {
    min: 0.01,
    max: 16,
    hinted: 'generic_6dof_joint_3d.cpp:58',
  }),
  damping: v.float(`${g}/damping`, {
    min: 0.01,
    max: 16,
    hinted: 'generic_6dof_joint_3d.cpp:59',
  }),
});

// generic_6dof_joint_3d.cpp:75-87: ADD_GROUP("Linear Motor", "linear_motor_").
const linearMotorLeaves: LeafTable = (g) => ({
  enabled: v.boolean(`${g}/enabled`),
  // target_velocity/force_limit: both PROPERTY_HINT_NONE (format-only suffix
  // "m/s" / "kg⋅m/s² (N)"), no PROPERTY_HINT_RANGE, so unbounded.
  target_velocity: v.float(`${g}/target_velocity`),
  force_limit: v.float(`${g}/force_limit`),
});

// generic_6dof_joint_3d.cpp:89-104: ADD_GROUP("Linear Spring", "linear_spring_").
const linearSpringLeaves: LeafTable = (g) => ({
  enabled: v.boolean(`${g}/enabled`),
  // stiffness/damping carry no PropertyInfo hint at all: unbounded.
  stiffness: v.float(`${g}/stiffness`),
  damping: v.float(`${g}/damping`),
  // equilibrium_point: PROPERTY_HINT_NONE, "suffix:m", unbounded.
  equilibrium_point: v.float(`${g}/equilibrium_point`),
});

// generic_6dof_joint_3d.cpp:106-133: ADD_GROUP("Angular Limit", "angular_limit_").
const angularLimitLeaves: LeafTable = (g) => ({
  enabled: v.boolean(`${g}/enabled`),
  // upper_angle/lower_angle: PROPERTY_HINT_RANGE "-180,180,0.01,radians_as_degrees"
  // (:109-110), no or_less/or_greater. The .tscn value is radians, hence the
  // combinator rather than a bare ±180 literal. set_param_x/y/z is index-only,
  // so this is hinted.
  upper_angle: v.radians(`${g}/upper_angle`, {
    minDeg: -180,
    maxDeg: 180,
    hinted: 'generic_6dof_joint_3d.cpp:109',
  }),
  lower_angle: v.radians(`${g}/lower_angle`, {
    minDeg: -180,
    maxDeg: 180,
    hinted: 'generic_6dof_joint_3d.cpp:110',
  }),
  // softness/damping: PROPERTY_HINT_RANGE "0.01,16,0.01", closed at both ends
  // (:111, :113). set_param_x/y/z assigns the value unaltered, so hinted.
  softness: v.float(`${g}/softness`, {
    min: 0.01,
    max: 16,
    hinted: 'generic_6dof_joint_3d.cpp:111',
  }),
  // Both ends from the hint (:112), like its linear twin, although the constructor writes 0
  // on every axis (:330, :360, :390), below Godot's own floor. The hint is what the engine
  // declares, the setter guards only the param index, and 0 is outside the inspector's range.
  restitution: v.float(`${g}/restitution`, {
    min: 0.01,
    max: 16,
    hinted: 'generic_6dof_joint_3d.cpp:112',
  }),
  damping: v.float(`${g}/damping`, {
    min: 0.01,
    max: 16,
    hinted: 'generic_6dof_joint_3d.cpp:113',
  }),
  // force_limit: PROPERTY_HINT_NONE, "suffix:kg⋅m²/s² (Nm)", unbounded.
  force_limit: v.float(`${g}/force_limit`),
  // erp: no hint at all, unbounded.
  erp: v.float(`${g}/erp`),
});

// generic_6dof_joint_3d.cpp:135-147: ADD_GROUP("Angular Motor", "angular_motor_").
const angularMotorLeaves: LeafTable = (g) => ({
  enabled: v.boolean(`${g}/enabled`),
  // target_velocity: PROPERTY_HINT_NONE, "radians_as_degrees,suffix:°/s". The degrees
  // label is a display hint on HINT_NONE, not a PROPERTY_HINT_RANGE, so it is unbounded.
  target_velocity: v.float(`${g}/target_velocity`),
  // force_limit: PROPERTY_HINT_NONE, "suffix:kg⋅m²/s² (Nm)", unbounded.
  force_limit: v.float(`${g}/force_limit`),
});

// generic_6dof_joint_3d.cpp:149-164: ADD_GROUP("Angular Spring", "angular_spring_").
const angularSpringLeaves: LeafTable = (g) => ({
  enabled: v.boolean(`${g}/enabled`),
  // stiffness/damping carry no hint at all: unbounded.
  stiffness: v.float(`${g}/stiffness`),
  damping: v.float(`${g}/damping`),
  // equilibrium_point: PROPERTY_HINT_RANGE "-180,180,0.01,radians_as_degrees"
  // (:154 for the x axis), the same ±180° bound as the angular_limit angles,
  // radian-converted. set_param_x/y/z is index-only, so this is hinted.
  equilibrium_point: v.radians(`${g}/equilibrium_point`, {
    minDeg: -180,
    maxDeg: 180,
    hinted: 'generic_6dof_joint_3d.cpp:154',
  }),
});

/** Strips the leading `<group>_<axis>/` segment, leaving the bare leaf name. */
const GROUP_AXIS_PREFIX_RE = /^[^/]+\//;

/**
 * The tag of a group's wildcard dispatcher, which `boundGrounding.test.ts` inspects instead of the
 * leaves. `formatOnly`: no leaf has a bound, and a leaf name outside the group's `ADD_PROPERTYI`
 * list is unreadable to Godot too. `hinted`: one representative cite, while each leaf's own cite
 * drives its severity. No `enforced`: `set_param_*`/`set_flag_*` guard only the index.
 */
type GroupClassification =
  | { readonly kind: 'formatOnly' }
  | { readonly kind: 'hinted'; readonly cite: string };

/**
 * Builds the `<group>_<axis>/*` dispatcher over one axis's instance of a
 * group's leaf table. The axis letter lives inside the segment this strips, so
 * the lookup is by bare leaf name while the full key is what reaches the leaf.
 */
function groupValidator(
  leaves: Readonly<Record<string, PropertyValidator>>,
  groupLabel: string,
  unknownCode: string,
  classification: GroupClassification
): PropertyValidator {
  const validator = accepts((key, value, line) => {
    const leafName = key.replace(GROUP_AXIS_PREFIX_RE, '');
    // hasOwn, so a leaf named `toString` cannot resolve an inherited function
    // and get called as a validator. The key is text the `.tscn` chooses.
    const leaf = Object.hasOwn(leaves, leafName) ? leaves[leafName] : undefined;
    if (!leaf) {
      return keyShapeError(key, line, `Unknown ${groupLabel} property: "${key}"`, unknownCode);
    }
    return leaf(key, value, line);
  }, `${groupLabel} parameter (see generic_6dof_joint_3d.cpp _bind_methods)`);
  if (classification.kind === 'formatOnly') {
    validator.formatOnly = true;
  } else {
    validator.grounding = { kind: classification.kind, cite: classification.cite };
  }
  // The dispatcher's own tag says nothing about the leaves behind it, so the
  // sweep recurses through these rather than stopping at the wildcard key.
  validator.leaves = Object.values(leaves);
  return validator;
}

/** The six groups. The tag belongs to the group, so all three axes of one group share it. */
const GROUPS = [
  // Bounded: softness/restitution/damping are each hinted 0.01-16
  // (generic_6dof_joint_3d.cpp:57-59). The cite names the first as representative.
  {
    prefix: 'linear_limit',
    leaves: linearLimitLeaves,
    label: 'linear limit',
    unknownCode: 'INVALID_LINEAR_LIMIT_KEY',
    classification: { kind: 'hinted', cite: 'generic_6dof_joint_3d.cpp:57' },
  },
  // Format-only: enabled (bool) plus two HINT_NONE floats, no bound anywhere.
  {
    prefix: 'linear_motor',
    leaves: linearMotorLeaves,
    label: 'linear motor',
    unknownCode: 'INVALID_LINEAR_MOTOR_KEY',
    classification: { kind: 'formatOnly' },
  },
  // Format-only: enabled (bool) plus three unhinted floats, no bound anywhere.
  {
    prefix: 'linear_spring',
    leaves: linearSpringLeaves,
    label: 'linear spring',
    unknownCode: 'INVALID_LINEAR_SPRING_KEY',
    classification: { kind: 'formatOnly' },
  },
  // Bounded: upper_angle/lower_angle hinted +-180 degrees
  // (generic_6dof_joint_3d.cpp:109-110) and softness/restitution/damping hinted
  // 0.01-16 (:111-113). The cite names upper_angle's line as representative.
  {
    prefix: 'angular_limit',
    leaves: angularLimitLeaves,
    label: 'angular limit',
    unknownCode: 'INVALID_ANGULAR_LIMIT_KEY',
    classification: { kind: 'hinted', cite: 'generic_6dof_joint_3d.cpp:109' },
  },
  // Format-only: enabled (bool) plus two HINT_NONE floats, no bound anywhere.
  {
    prefix: 'angular_motor',
    leaves: angularMotorLeaves,
    label: 'angular motor',
    unknownCode: 'INVALID_ANGULAR_MOTOR_KEY',
    classification: { kind: 'formatOnly' },
  },
  // Bounded: equilibrium_point hinted +-180 degrees (generic_6dof_joint_3d.cpp:154),
  // the group's only real bound.
  {
    prefix: 'angular_spring',
    leaves: angularSpringLeaves,
    label: 'angular spring',
    unknownCode: 'INVALID_ANGULAR_SPRING_KEY',
    classification: { kind: 'hinted', cite: 'generic_6dof_joint_3d.cpp:154' },
  },
] as const satisfies readonly {
  prefix: string;
  leaves: LeafTable;
  label: string;
  unknownCode: string;
  classification: GroupClassification;
}[];

/**
 * A wildcard per group per axis, since registry wildcards match only a literal `<prefix>/*` and
 * the axis is part of the group name. Plus an exact key for every leaf with `validator.bounds`,
 * so a sweep reading `bounds`/`tiers` sees them, which the bound-free dispatcher cannot claim.
 * The exact keys change no verdict: the dispatcher forwards the full key to the same leaf.
 */
const registrations: Record<string, PropertyValidator> = {};
for (const { prefix, leaves, label, unknownCode, classification } of GROUPS) {
  for (const axis of ['x', 'y', 'z']) {
    const groupPrefix = `${prefix}_${axis}`;
    const table = leaves(groupPrefix);
    registrations[`${groupPrefix}/*`] = groupValidator(table, label, unknownCode, classification);
    for (const [leaf, validator] of Object.entries(table)) {
      if (validator.bounds) registrations[`${groupPrefix}/${leaf}`] = validator;
    }
  }
}

validatorRegistry.registerAll('Generic6DOFJoint3D', registrations);
