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
 * registrations (6 groups × 3 axes). Every one of Godot's three per-axis
 * `ADD_PROPERTYI` calls for a given leaf uses byte-identical
 * `PropertyInfo` (same hint, same range), so ONE table per group describes
 * all three axes — but each axis gets its own instance of it, built from
 * the axis-qualified key. `v.float` bakes the name it is handed into both
 * the message and the derived codes, so a table shared across axes reports
 * `softness` for a file that wrote `linear_limit_y/softness`, and the three
 * `damping` leaves that carry different bounds all derive one code.
 *
 * Each leaf validator is individually grounded (`v.float`/`v.radians`
 * `hinted:`, `v.boolean` format-only), but `boundGrounding.test.ts`'s sweep
 * inspects the function REGISTERED under the wildcard key, i.e. the
 * dispatcher `groupValidator` returns, not the leaves it forwards to — so
 * each of the 18 dispatchers carries its own `formatOnly` or `grounding` tag
 * too, set by `groupValidator`'s `classification` parameter. The tag is a
 * property of the GROUP, so all three axes of one group get the same one.
 */

import '../../joints/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { accepts, keyShapeError, v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

/**
 * One group's leaves, built for the `<group>_<axis>` prefix its keys carry —
 * `linear_limit_y` gives `linear_limit_y/softness`.
 *
 * A function rather than a constant because every leaf name reaches `v.float`
 * as the property NAME, which is what the message quotes and what
 * `formatCode`/`valueCode` derive the codes from: the validator has to be built
 * per axis for either to name the key the file actually wrote.
 */
type LeafTable = (groupPrefix: string) => Readonly<Record<string, PropertyValidator>>;

// generic_6dof_joint_3d.cpp:52-73 — ADD_GROUP("Linear Limit", "linear_limit_"),
// identical PropertyInfo per leaf on the x/y/z ADD_PROPERTYI trio, dispatched
// through set_param_x/y/z. Each opens with `ERR_FAIL_INDEX(p_param, PARAM_MAX)`
// (:200, :215, :229) guarding the Param enum INDEX only — no predicate touches
// p_value — then assigns it straight through (:201, :216, :230). An index guard
// grounds no value bound, so every bound below is hinted.
const linearLimitLeaves: LeafTable = (g) => ({
  enabled: v.boolean(`${g}/enabled`),
  // upper_distance/lower_distance: PROPERTY_HINT_NONE, "suffix:m" — no
  // PROPERTY_HINT_RANGE at all, so unbounded.
  upper_distance: v.float(`${g}/upper_distance`),
  lower_distance: v.float(`${g}/lower_distance`),
  // softness/restitution/damping: PROPERTY_HINT_RANGE "0.01,16,0.01", closed at
  // both ends (:57-59); set_param_x/y/z assigns the value unaltered, so hinted.
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

// generic_6dof_joint_3d.cpp:75-87 — ADD_GROUP("Linear Motor", "linear_motor_").
const linearMotorLeaves: LeafTable = (g) => ({
  enabled: v.boolean(`${g}/enabled`),
  // target_velocity/force_limit: both PROPERTY_HINT_NONE (format-only suffix
  // "m/s" / "kg⋅m/s² (N)") — no PROPERTY_HINT_RANGE, so unbounded.
  target_velocity: v.float(`${g}/target_velocity`),
  force_limit: v.float(`${g}/force_limit`),
});

// generic_6dof_joint_3d.cpp:89-104 — ADD_GROUP("Linear Spring", "linear_spring_").
const linearSpringLeaves: LeafTable = (g) => ({
  enabled: v.boolean(`${g}/enabled`),
  // stiffness/damping carry no PropertyInfo hint at all: unbounded.
  stiffness: v.float(`${g}/stiffness`),
  damping: v.float(`${g}/damping`),
  // equilibrium_point: PROPERTY_HINT_NONE, "suffix:m" — unbounded.
  equilibrium_point: v.float(`${g}/equilibrium_point`),
});

// generic_6dof_joint_3d.cpp:106-133 — ADD_GROUP("Angular Limit", "angular_limit_").
const angularLimitLeaves: LeafTable = (g) => ({
  enabled: v.boolean(`${g}/enabled`),
  // upper_angle/lower_angle: PROPERTY_HINT_RANGE "-180,180,0.01,radians_as_degrees"
  // (:109-110) — no or_less/or_greater; the .tscn value is radians, hence the
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
  // (:111, :113); set_param_x/y/z assigns the value unaltered, so hinted.
  softness: v.float(`${g}/softness`, {
    min: 0.01,
    max: 16,
    hinted: 'generic_6dof_joint_3d.cpp:111',
  }),
  // Both ends from the hint (:112), like its linear twin, even though the
  // constructor writes 0 on every axis (:330, :360, :390) — below Godot's own
  // floor. That contradiction is the engine's; the hint is what the engine
  // DECLARES, the setter guards only the param index, and a warning saying 0 is
  // outside the inspector's range is true either way.
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
  // force_limit: PROPERTY_HINT_NONE, "suffix:kg⋅m²/s² (Nm)" — unbounded.
  force_limit: v.float(`${g}/force_limit`),
  // erp: no hint at all — unbounded.
  erp: v.float(`${g}/erp`),
});

// generic_6dof_joint_3d.cpp:135-147 — ADD_GROUP("Angular Motor", "angular_motor_").
const angularMotorLeaves: LeafTable = (g) => ({
  enabled: v.boolean(`${g}/enabled`),
  // target_velocity: PROPERTY_HINT_NONE, "radians_as_degrees,suffix:°/s" — the
  // degrees label is a display hint riding on HINT_NONE, not a
  // PROPERTY_HINT_RANGE, so there is no bound to convert: unbounded.
  target_velocity: v.float(`${g}/target_velocity`),
  // force_limit: PROPERTY_HINT_NONE, "suffix:kg⋅m²/s² (Nm)" — unbounded.
  force_limit: v.float(`${g}/force_limit`),
});

// generic_6dof_joint_3d.cpp:149-164 — ADD_GROUP("Angular Spring", "angular_spring_").
const angularSpringLeaves: LeafTable = (g) => ({
  enabled: v.boolean(`${g}/enabled`),
  // stiffness/damping carry no hint at all: unbounded.
  stiffness: v.float(`${g}/stiffness`),
  damping: v.float(`${g}/damping`),
  // equilibrium_point: PROPERTY_HINT_RANGE "-180,180,0.01,radians_as_degrees"
  // (:154 for the x axis) — same ±180° bound as the angular_limit angles,
  // radian-converted; set_param_x/y/z is index-only, so this is hinted.
  equilibrium_point: v.radians(`${g}/equilibrium_point`, {
    minDeg: -180,
    maxDeg: 180,
    hinted: 'generic_6dof_joint_3d.cpp:154',
  }),
});

/** Strips the leading `<group>_<axis>/` segment, leaving the bare leaf name. */
const GROUP_AXIS_PREFIX_RE = /^[^/]+\//;

/**
 * How a group's wildcard dispatcher itself is classified for
 * `boundGrounding.test.ts`'s sweep. That sweep inspects only the function
 * REGISTERED under the wildcard key (this dispatcher), never the per-leaf
 * validators it forwards to, so the dispatcher needs its own tag even though
 * every leaf above is already individually `v.float`/`v.radians`-grounded or
 * `v.boolean`-format-only.
 *
 * `formatOnly` when no leaf in the group carries a bound at all (the group is
 * booleans and HINT_NONE floats, so the dispatcher rejects only what Godot's
 * own parser could not read either — an unrecognised leaf name included, since
 * no `.tscn` the engine saves carries a leaf outside the group's fixed
 * `ADD_PROPERTYI` list). `hinted` when at least one leaf has a real
 * `PROPERTY_HINT_RANGE` bound; the citation names ONE governing line as a
 * representative for the sweep — each leaf's own exact citation (which may
 * differ line-to-line within the group) is what actually drives that leaf's
 * severity, via its own `v.float`/`v.radians` call above.
 *
 * No `'enforced'` variant: `set_param_x/y/z` and `set_flag_x/y/z` are
 * index-only guards (`ERR_FAIL_INDEX(p_param, PARAM_MAX)`) followed by a bare
 * assignment, on every leaf in every group, so nothing on this node is ever
 * enforced.
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

/**
 * The six groups. `cite` names ONE governing line per group as the dispatcher's
 * representative for `boundGrounding.test.ts`; each leaf's own citation above is
 * what drives that leaf's severity.
 */
const GROUPS = [
  // Bounded: softness/restitution/damping are each hinted 0.01-16
  // (generic_6dof_joint_3d.cpp:57-59); citing the first as representative.
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
  // 0.01-16 (:111-113); citing upper_angle's line as representative.
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
 * Wildcard per group per axis, plus an EXACT key for every leaf carrying a bound.
 *
 * The exact keys change no verdict: `findOwnValidator` resolves them before the
 * wildcards, and the dispatcher forwards the FULL key to the same leaf function
 * unchanged, so both routes return the identical `ParseError`. What changes is
 * what the registry REPORTS — a sweep reading `bounds`/`tiers` off
 * `findValidator` otherwise sees the dispatcher, which carries neither and must
 * not claim either, since `enabled` and `upper_distance` sit in the same group
 * with no bound at all. Selected by `validator.bounds` rather than by a list of
 * leaf names, so a leaf that later gains a bound is exposed with it.
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
