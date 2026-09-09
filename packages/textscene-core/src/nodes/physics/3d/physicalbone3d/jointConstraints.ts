/**
 * `joint_constraints/...` validators, one leaf table per key prefix.
 *
 * `PhysicalBone3D::_set` (physical_bone_3d.cpp:716-724) forwards the key to the
 * live `JointData` subclass and returns false when it has no arm for it, so a
 * leaf outside its table is a dropped write. Only `SixDOFJointData::_set`
 * reads an axis segment (:452-466), and its arm chain (:468-598, ending
 * `else { return false; }`) names exactly its own 21 per-axis leaves; the four
 * flat subclasses' chains (Pin :114-133, Cone :171-202, Hinge :246-283, Slider
 * :330-391) compare the WHOLE key, so none of them sees an axis and none of
 * them carries a SixDOF-only leaf. Hence the axis prefixes take the SixDOF set
 * alone, and the bare prefix the union of the flat sets.
 *
 * Which of the flat subclasses is live depends on the sibling `joint_type`, a
 * value no validator sees, so the bare table is a UNION: a Pin leaf under a
 * Hinge joint is a dropped write this layer cannot name. `bias` is the one
 * leaf two flat subclasses bound differently (Pin 0.01-0.99 vs Cone
 * 0.01-16.0), and takes the wider hint for the same reason.
 *
 * Every table is built for the key PREFIX it serves — `v.float` bakes the name
 * into the message and codes. Every JointData `_set` stores the value
 * unconditionally (the joint RID check gates only the PhysicsServer3D call),
 * so every bound here is hinted, never enforced.
 */

import { accepts, keyShapeError, v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

type Leaves = Readonly<Record<string, PropertyValidator>>;

/**
 * The three angular-limit leaves Hinge (:317-320), Slider (:438-440) and
 * SixDOF (:696-698) hint identically; `at` names the ADD_PROPERTY lines of the
 * subclass the table serves.
 */
const angularLimitLeaves = (p: string, at: { upper: string; lower: string; softness: string }): Leaves => ({
  angular_limit_upper: v.float(`${p}angular_limit_upper`, { min: -180, max: 180, hinted: at.upper }),
  angular_limit_lower: v.float(`${p}angular_limit_lower`, { min: -180, max: 180, hinted: at.lower }),
  angular_limit_softness: v.float(`${p}angular_limit_softness`, { min: 0.01, max: 16, hinted: at.softness }),
});

// PinJointData::_get_property_list — physical_bone_3d.cpp:160-162
const pinLeaves = (p: string): Leaves => ({
  bias: v.float(`${p}bias`, { min: 0.01, max: 0.99, hinted: 'physical_bone_3d.cpp:160' }),
  damping: v.float(`${p}damping`, { min: 0.01, max: 8.0, hinted: 'physical_bone_3d.cpp:161' }),
  impulse_clamp: v.float(`${p}impulse_clamp`, { min: 0.0, max: 64.0, hinted: 'physical_bone_3d.cpp:162' }),
});

// ConeJointData::_get_property_list — physical_bone_3d.cpp:233-237. Degrees
// are on the wire: ConeJointData::_set/_get (:171-175, :204-206) convert
// themselves, so no radians conversion belongs on swing_span/twist_span.
const coneLeaves = (p: string): Leaves => ({
  swing_span: v.float(`${p}swing_span`, { min: -180, max: 180, hinted: 'physical_bone_3d.cpp:233' }),
  // Both or_less and or_greater (:234): unbounded.
  twist_span: v.float(`${p}twist_span`),
  bias: v.float(`${p}bias`, { min: 0.01, max: 16.0, hinted: 'physical_bone_3d.cpp:235' }),
  softness: v.float(`${p}softness`, { min: 0.01, max: 16.0, hinted: 'physical_bone_3d.cpp:236' }),
  relaxation: v.float(`${p}relaxation`, { min: 0.01, max: 16.0, hinted: 'physical_bone_3d.cpp:237' }),
});

// HingeJointData::_get_property_list — physical_bone_3d.cpp:316-321
const hingeLeaves = (p: string): Leaves => ({
  angular_limit_enabled: v.boolean(`${p}angular_limit_enabled`),
  ...angularLimitLeaves(p, {
    upper: 'physical_bone_3d.cpp:317',
    lower: 'physical_bone_3d.cpp:318',
    softness: 'physical_bone_3d.cpp:320',
  }),
  angular_limit_bias: v.float(`${p}angular_limit_bias`, { min: 0.01, max: 0.99, hinted: 'physical_bone_3d.cpp:319' }),
  angular_limit_relaxation: v.float(`${p}angular_limit_relaxation`, { min: 0.01, max: 16, hinted: 'physical_bone_3d.cpp:321' }),
});

// SliderJointData::_get_property_list — physical_bone_3d.cpp:432-442.
// linear_limit_upper/lower carry no PROPERTY_HINT_RANGE at all: unbounded.
const sliderLeaves = (p: string): Leaves => ({
  linear_limit_upper: v.float(`${p}linear_limit_upper`),
  linear_limit_lower: v.float(`${p}linear_limit_lower`),
  linear_limit_softness: v.float(`${p}linear_limit_softness`, { min: 0.01, max: 16.0, hinted: 'physical_bone_3d.cpp:434' }),
  linear_limit_restitution: v.float(`${p}linear_limit_restitution`, { min: 0.01, max: 16.0, hinted: 'physical_bone_3d.cpp:435' }),
  linear_limit_damping: v.float(`${p}linear_limit_damping`, { min: 0, max: 16.0, hinted: 'physical_bone_3d.cpp:436' }),
  ...angularLimitLeaves(p, {
    upper: 'physical_bone_3d.cpp:438',
    lower: 'physical_bone_3d.cpp:439',
    softness: 'physical_bone_3d.cpp:440',
  }),
  angular_limit_restitution: v.float(`${p}angular_limit_restitution`, { min: 0.01, max: 16.0, hinted: 'physical_bone_3d.cpp:441' }),
  angular_limit_damping: v.float(`${p}angular_limit_damping`, { min: 0, max: 16.0, hinted: 'physical_bone_3d.cpp:442' }),
});

/** SixDOFJointData::_get_property_list — physical_bone_3d.cpp:680-704, one copy per axis. */
const sixDofLeaves = (p: string): Leaves => ({
  linear_limit_enabled: v.boolean(`${p}linear_limit_enabled`),
  linear_limit_upper: v.float(`${p}linear_limit_upper`),
  linear_limit_lower: v.float(`${p}linear_limit_lower`),
  linear_limit_softness: v.float(`${p}linear_limit_softness`, { min: 0.01, max: 16, hinted: 'physical_bone_3d.cpp:688' }),
  linear_spring_enabled: v.boolean(`${p}linear_spring_enabled`),
  linear_spring_stiffness: v.float(`${p}linear_spring_stiffness`),
  linear_spring_damping: v.float(`${p}linear_spring_damping`),
  linear_equilibrium_point: v.float(`${p}linear_equilibrium_point`),
  linear_restitution: v.float(`${p}linear_restitution`, { min: 0.01, max: 16, hinted: 'physical_bone_3d.cpp:693' }),
  linear_damping: v.float(`${p}linear_damping`, { min: 0.01, max: 16, hinted: 'physical_bone_3d.cpp:694' }),
  angular_limit_enabled: v.boolean(`${p}angular_limit_enabled`),
  ...angularLimitLeaves(p, {
    upper: 'physical_bone_3d.cpp:696',
    lower: 'physical_bone_3d.cpp:697',
    softness: 'physical_bone_3d.cpp:698',
  }),
  angular_restitution: v.float(`${p}angular_restitution`, { min: 0.01, max: 16, hinted: 'physical_bone_3d.cpp:699' }),
  angular_damping: v.float(`${p}angular_damping`, { min: 0.01, max: 16, hinted: 'physical_bone_3d.cpp:700' }),
  erp: v.float(`${p}erp`),
  angular_spring_enabled: v.boolean(`${p}angular_spring_enabled`),
  angular_spring_stiffness: v.float(`${p}angular_spring_stiffness`),
  angular_spring_damping: v.float(`${p}angular_spring_damping`),
  angular_equilibrium_point: v.float(`${p}angular_equilibrium_point`),
});

/** `JointType` (physical_bone_3d.cpp:913-918): the subclass each value builds (:1094-1113). */
export const JOINT_DATA = {
  1: { name: 'PinJointData', leaves: pinLeaves, refusedAt: 'physical_bone_3d.cpp:133' },
  2: { name: 'ConeJointData', leaves: coneLeaves, refusedAt: 'physical_bone_3d.cpp:202' },
  3: { name: 'HingeJointData', leaves: hingeLeaves, refusedAt: 'physical_bone_3d.cpp:283' },
  4: { name: 'SliderJointData', leaves: sliderLeaves, refusedAt: 'physical_bone_3d.cpp:391' },
  5: { name: 'SixDOFJointData', leaves: sixDofLeaves, refusedAt: 'physical_bone_3d.cpp:466/599' },
} as const;
export type JointType = keyof typeof JOINT_DATA;
const FLAT_TYPES: readonly JointType[] = [1, 2, 3, 4];

/**
 * The bare-prefix table: Pin ∪ Cone ∪ Hinge ∪ Slider, later spreads winning
 * the two shared names — Cone's wider `bias` hint, and Slider's identical
 * angular-limit bounds.
 */
const flatLeaves = (p: string): Leaves =>
  Object.assign({}, ...FLAT_TYPES.map((type) => JOINT_DATA[type].leaves(p))) as Leaves;

const JOINT_CONSTRAINTS_PREFIX = 'joint_constraints/';
const AXIS_PREFIX_RE = /^[xyz]\//;

/** A closed set of four prefixes: anything else reaches no table and is refused below. */
const LEAF_TABLES: ReadonlyMap<string, Leaves> = new Map([
  ['', flatLeaves(JOINT_CONSTRAINTS_PREFIX)],
  ...(['x/', 'y/', 'z/'] as const).map(
    (axis) => [axis, sixDofLeaves(`${JOINT_CONSTRAINTS_PREFIX}${axis}`)] as const
  ),
]);

/** Where a key's prefix and leaf sit: `axis` is `''` or `x/`|`y/`|`z/`. */
function splitKey(key: string): { axis: string; leaf: string } {
  const rest = key.slice(JOINT_CONSTRAINTS_PREFIX.length);
  const axis = AXIS_PREFIX_RE.exec(rest)?.[0] ?? '';
  return { axis, leaf: rest.slice(axis.length) };
}

const LEAF_NAMES = new Map<JointType, ReadonlySet<string>>(
  ([1, 2, 3, 4, 5] as const).map((type) => [type, new Set(Object.keys(JOINT_DATA[type].leaves('')))])
);

/**
 * The joint types whose `_set` has an arm for `key`, or `null` for a leaf none
 * declares — the phase-1 dispatcher's refusal, not a rule's. Only SixDOF reads
 * an axis segment (:452-466), and only through one.
 */
export function jointConstraintOwners(key: string): ReadonlySet<JointType> | null {
  const { axis, leaf } = splitKey(key);
  const owners = (axis === '' ? FLAT_TYPES : ([5] as const)).filter((type) => LEAF_NAMES.get(type)!.has(leaf));
  return owners.length === 0 ? null : new Set(owners);
}

/**
 * Dispatches a `joint_constraints/...` key to the validator for its prefix and
 * leaf. Checked before refusing an unknown leaf: physical_bone_3d.cpp has no
 * `joint_constraints` rename/compat shim (its `#ifndef DISABLE_DEPRECATED`
 * blocks, :34-36 and :1047-1055, concern the pre-PhysicalBoneSimulator3D
 * parenting path), so no legacy leaf name a real 4.x scene could carry is
 * wrongly rejected here.
 */
export const jointConstraintsValidator: PropertyValidator = accepts((key, value, line) => {
  const { axis, leaf: leafName } = splitKey(key);
  const table = LEAF_TABLES.get(axis) ?? {};
  // hasOwn, so a leaf named `toString` cannot resolve an inherited function and
  // get called as a validator. The key is text the `.tscn` chooses.
  const leaf = Object.hasOwn(table, leafName) ? table[leafName] : undefined;
  if (!leaf) {
    return keyShapeError(
      key,
      line,
      `Unknown joint constraint property: "${key}"`,
      'INVALID_JOINT_CONSTRAINTS_KEY'
    );
  }
  return leaf(key, value, line);
}, 'joint-type-dependent constraint (float or bool — see PinJointData/ConeJointData/HingeJointData/SliderJointData/SixDOFJointData)');
// This dispatcher performs no comparison of its own: its only rejection is an
// unrecognised leaf NAME, a format concern. Every magnitude bound lives in the
// leaf tables, so all four are exposed for the sweep to recurse through.
jointConstraintsValidator.formatOnly = true;
jointConstraintsValidator.leaves = [...LEAF_TABLES.values()].flatMap((table) =>
  Object.values(table)
);
