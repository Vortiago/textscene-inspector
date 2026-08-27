/**
 * PhysicalBone3D strict validators for linting.
 *
 * Declare only PhysicalBone3D's OWN members — the ones doc/classes/PhysicalBone3D.xml
 * lists without an `overrides=` attribute — plus two families the XML omits but
 * the .cpp genuinely serialises, only visible by reading `_get_property_list` /
 * `_set` / `_get` rather than `ADD_PROPERTY`:
 *
 *   - `bone_name`: a virtual `StringName` property (physical_bone_3d.cpp:709-745),
 *     never an `ADD_PROPERTY`. Godot cannot statically enumerate valid bone names
 *     (they come from the parent Skeleton3D at runtime), so only the StringName
 *     literal format is checked.
 *   - `joint_constraints/...`: per-joint-type parameters. Each `JointData`
 *     subclass (PinJointData, ConeJointData, HingeJointData, SliderJointData,
 *     SixDOFJointData) re-registers this family from scratch in its own
 *     `_get_property_list`, keyed on the runtime `joint_type` — never a static
 *     ADD_PROPERTY. SixDOFJointData nests its copy under an
 *     `joint_constraints/<x|y|z>/...` axis prefix.
 *
 * Everything from Node3D up is registered on the ancestor and delivered by the
 * NODE_BASE_TYPES base-walk, so re-declaring an inherited key shadows it and
 * duplicates the rule. PhysicsBody3D itself binds no properties of its own, so
 * nothing is skipped at that hop.
 */

import '../../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { accepts, keyShapeError, v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

// physical_bone_3d.cpp:891, 913-918 — 6 BIND_ENUM_CONSTANT (JOINT_TYPE_NONE..JOINT_TYPE_6DOF)
const JOINT_TYPE = { 0: 'NONE', 1: 'PIN', 2: 'CONE', 3: 'HINGE', 4: 'SLIDER', 5: '6DOF' };
// physical_bone_3d.cpp:902,904,910-911 — 2 BIND_ENUM_CONSTANT (DAMP_MODE_COMBINE/REPLACE)
const DAMP_MODE = { 0: 'COMBINE', 1: 'REPLACE' };

/**
 * `joint_constraints/<leaf>` (or, for SixDOFJointData, `joint_constraints/<x|y|z>/<leaf>`)
 * validators, keyed by the trailing leaf name once any axis segment is stripped.
 *
 * A validator only ever sees a single key and value, never the sibling
 * `joint_type` that decides which JointData subclass actually owns a given
 * key — so a leaf name reused across joint types with a DIFFERENT bound
 * ("bias": PinJointData 0.01-0.99 vs ConeJointData 0.01-16.0, the one real
 * collision) is checked against the UNION of every joint type's bound rather
 * than either alone, so a value genuinely valid for its own (to us, unknown)
 * joint type is never flagged. Every other leaf name that recurs across joint
 * types (angular_limit_upper/lower/softness, linear_limit_upper/lower) carries
 * an identical bound everywhere it appears, so there is no ambiguity to resolve.
 */
// Every JointData subclass's `_set` (physical_bone_3d.cpp:114-704) stores the
// value unconditionally (only gated on whether the live joint RID matches its
// own type, for the PhysicsServer3D call, not for the stored field), so every
// bound in this table is hinted, never enforced.
const JOINT_CONSTRAINT_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // PinJointData::_get_property_list — physical_bone_3d.cpp:160-162
  damping: v.float('damping', { min: 0.01, max: 8.0, hinted: 'physical_bone_3d.cpp:161' }),
  impulse_clamp: v.float('impulse_clamp', {
    min: 0.0,
    max: 64.0,
    hinted: 'physical_bone_3d.cpp:162',
  }),
  // bias: union of PinJointData (0.01-0.99, physical_bone_3d.cpp:160) and
  // ConeJointData (0.01-16.0, physical_bone_3d.cpp:235)
  bias: v.float('bias', { min: 0.01, max: 16.0, hinted: 'physical_bone_3d.cpp:235' }),

  // ConeJointData::_get_property_list — physical_bone_3d.cpp:233-237. Degrees
  // genuinely are on the wire here: ConeJointData::_set/_get (:171-175, :204-206)
  // do their own deg_to_rad/rad_to_deg, unlike ConeTwistJoint3D's set_param,
  // so no v.radians conversion belongs on these two.
  swing_span: v.float('swing_span', { min: -180, max: 180, hinted: 'physical_bone_3d.cpp:233' }),
  // twist_span hint carries both or_less and or_greater: both ends are soft
  // editor bounds, so the real value is unbounded (physical_bone_3d.cpp:234)
  twist_span: v.float('twist_span'),
  softness: v.float('softness', { min: 0.01, max: 16.0, hinted: 'physical_bone_3d.cpp:236' }),
  relaxation: v.float('relaxation', { min: 0.01, max: 16.0, hinted: 'physical_bone_3d.cpp:237' }),

  // HingeJointData::_get_property_list — physical_bone_3d.cpp:316-321 — the
  // enabled/upper/lower/softness leaves are shared verbatim (same bound) with
  // SliderJointData's angular_limit_* and SixDOFJointData's per-axis leaves;
  // all three subclasses do their own deg_to_rad, so angles stay plain floats.
  angular_limit_enabled: v.boolean('angular_limit_enabled'),
  angular_limit_upper: v.float('angular_limit_upper', {
    min: -180,
    max: 180,
    hinted: 'physical_bone_3d.cpp:317',
  }),
  angular_limit_lower: v.float('angular_limit_lower', {
    min: -180,
    max: 180,
    hinted: 'physical_bone_3d.cpp:318',
  }),
  // angular_limit_bias: HingeJointData only.
  angular_limit_bias: v.float('angular_limit_bias', {
    min: 0.01,
    max: 0.99,
    hinted: 'physical_bone_3d.cpp:319',
  }),
  angular_limit_softness: v.float('angular_limit_softness', {
    min: 0.01,
    max: 16,
    hinted: 'physical_bone_3d.cpp:320',
  }),
  // angular_limit_relaxation: HingeJointData only.
  angular_limit_relaxation: v.float('angular_limit_relaxation', {
    min: 0.01,
    max: 16,
    hinted: 'physical_bone_3d.cpp:321',
  }),

  // SliderJointData::_get_property_list — physical_bone_3d.cpp:432-442
  // linear_limit_upper/lower carry NO PROPERTY_HINT_RANGE at all (not even a
  // soft one) in both SliderJointData and SixDOFJointData: unbounded.
  linear_limit_upper: v.float('linear_limit_upper'),
  linear_limit_lower: v.float('linear_limit_lower'),
  linear_limit_softness: v.float('linear_limit_softness', {
    min: 0.01,
    max: 16.0,
    hinted: 'physical_bone_3d.cpp:434',
  }),
  linear_limit_restitution: v.float('linear_limit_restitution', {
    min: 0.01,
    max: 16.0,
    hinted: 'physical_bone_3d.cpp:435',
  }),
  linear_limit_damping: v.float('linear_limit_damping', {
    min: 0,
    max: 16.0,
    hinted: 'physical_bone_3d.cpp:436',
  }),
  angular_limit_restitution: v.float('angular_limit_restitution', {
    min: 0.01,
    max: 16.0,
    hinted: 'physical_bone_3d.cpp:441',
  }),
  angular_limit_damping: v.float('angular_limit_damping', {
    min: 0,
    max: 16.0,
    hinted: 'physical_bone_3d.cpp:442',
  }),

  // SixDOFJointData::_get_property_list per-axis leaves — physical_bone_3d.cpp:680-704
  // (angular_limit_enabled/upper/lower/softness above are this struct's leaves too)
  linear_limit_enabled: v.boolean('linear_limit_enabled'),
  linear_spring_enabled: v.boolean('linear_spring_enabled'),
  linear_spring_stiffness: v.float('linear_spring_stiffness'),
  linear_spring_damping: v.float('linear_spring_damping'),
  linear_equilibrium_point: v.float('linear_equilibrium_point'),
  linear_restitution: v.float('linear_restitution', {
    min: 0.01,
    max: 16,
    hinted: 'physical_bone_3d.cpp:693',
  }),
  linear_damping: v.float('linear_damping', {
    min: 0.01,
    max: 16,
    hinted: 'physical_bone_3d.cpp:694',
  }),
  angular_restitution: v.float('angular_restitution', {
    min: 0.01,
    max: 16,
    hinted: 'physical_bone_3d.cpp:699',
  }),
  angular_damping: v.float('angular_damping', {
    min: 0.01,
    max: 16,
    hinted: 'physical_bone_3d.cpp:700',
  }),
  erp: v.float('erp'),
  angular_spring_enabled: v.boolean('angular_spring_enabled'),
  angular_spring_stiffness: v.float('angular_spring_stiffness'),
  angular_spring_damping: v.float('angular_spring_damping'),
  angular_equilibrium_point: v.float('angular_equilibrium_point'),
};

const JOINT_CONSTRAINTS_PREFIX = 'joint_constraints/';
const AXIS_PREFIX_RE = /^[xyz]\//;

/** Dispatches a `joint_constraints/...` key to the validator for its leaf name. */
/**
 * A leaf outside this table is flagged rather than passed through. Checked
 * before choosing that: physical_bone_3d.cpp has no `joint_constraints`
 * rename/compat shim (its two `#ifndef DISABLE_DEPRECATED` blocks, lines
 * 34-36 and 1047-1055, are about the pre-PhysicalBoneSimulator3D parenting
 * path, not property naming), so there is no legacy leaf name a real 4.x
 * scene could carry that this table would then wrongly reject. The 18-node
 * real ragdoll corpus (ConeJointData only) lints clean against it.
 */
const jointConstraintsValidator: PropertyValidator = accepts((key, value, line) => {
  const rest = key.slice(JOINT_CONSTRAINTS_PREFIX.length);
  const leafName = rest.replace(AXIS_PREFIX_RE, '');
  // hasOwn, so a leaf named `toString` cannot resolve an inherited function and
  // get called as a validator. The key is text the `.tscn` chooses.
  const leaf = Object.hasOwn(JOINT_CONSTRAINT_LEAVES, leafName)
    ? JOINT_CONSTRAINT_LEAVES[leafName]
    : undefined;
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
// `JOINT_CONSTRAINT_LEAVES` table, so the table is exposed for the sweep to
// recurse through: tagging the dispatcher alone would vouch for bounds it never
// looks at.
jointConstraintsValidator.formatOnly = true;
jointConstraintsValidator.leaves = Object.values(JOINT_CONSTRAINT_LEAVES);

validatorRegistry.registerAll('PhysicalBone3D', {
  // physical_bone_3d.cpp:709-745 — virtual STRING_NAME property (_get_property_list/
  // _set/_get), not an ADD_PROPERTY; not in doc/classes/PhysicalBone3D.xml either.
  bone_name: v.stringName('bone_name'),

  // physical_bone_3d.cpp:891 — PROPERTY_HINT_ENUM "None,PinJoint,ConeJoint,HingeJoint,SliderJoint,6DOFJoint".
  // set_joint_type (:1088-1113) switches over the enum with no default case
  // and no ERR_FAIL: an out-of-range value is inert, not guarded, so this is hinted.
  joint_type: v.enumInt('joint_type', 0, 5, JOINT_TYPE, { hinted: 'physical_bone_3d.cpp:891' }),
  // physical_bone_3d.cpp:892 — Transform3D, PROPERTY_HINT_NONE (format only, "suffix:m")
  joint_offset: v.transform3d('joint_offset'),
  // physical_bone_3d.cpp:893 — PROPERTY_HINT_RANGE "-360,360,0.01,or_less,or_greater,radians_as_degrees":
  // both or_less and or_greater present, so both ends are soft editor bounds — unbounded.
  joint_rotation: v.vector3('joint_rotation'),
  // physical_bone_3d.cpp:895 — Transform3D, PROPERTY_HINT_NONE (format only, "suffix:m")
  body_offset: v.transform3d('body_offset'),
  // physical_bone_3d.cpp:897 hints "0.01,1000,0.01,or_greater,exp,suffix:kg" —
  // `or_greater` opens the ceiling. set_mass (:1190) is
  // `ERR_FAIL_COND(p_mass <= 0)`, so the setter refuses at 0 and (0, 0.01) is
  // a value Godot stores that the inspector excludes.
  mass: v.float('mass', {
    enforcedMin: { at: 0, exclusive: true },
    min: 0.01,
    enforced: { min: 'physical_bone_3d.cpp:1190' },
    hinted: { min: 'physical_bone_3d.cpp:897' },
  }),
  // physical_bone_3d.cpp:898 hints "0,1,0.01". set_friction (:1199-1200) is
  // `ERR_FAIL_COND(p_friction < 0 || p_friction > 1)`: both ends enforced.
  friction: v.float('friction', { min: 0, max: 1, enforced: 'physical_bone_3d.cpp:1200' }),
  // physical_bone_3d.cpp:899 hints "0,1,0.01". set_bounce (:1210-1211) is
  // `ERR_FAIL_COND(p_bounce < 0 || p_bounce > 1)`: both ends enforced.
  bounce: v.float('bounce', { min: 0, max: 1, enforced: 'physical_bone_3d.cpp:1211' }),
  // physical_bone_3d.cpp:900 — PROPERTY_HINT_RANGE "-8,8,0.001,or_less,or_greater":
  // both or_less and or_greater present — unbounded.
  gravity_scale: v.float('gravity_scale'),
  // physical_bone_3d.cpp:901
  custom_integrator: v.boolean('custom_integrator'),
  // physical_bone_3d.cpp:902 — PROPERTY_HINT_ENUM "Combine,Replace". set_linear_damp_mode
  // is a bare assignment, so out-of-range warns.
  linear_damp_mode: v.enumInt('linear_damp_mode', 0, 1, DAMP_MODE, {
    hinted: 'physical_bone_3d.cpp:902',
  }),
  // physical_bone_3d.cpp:903 hints "0,100,0.001,or_greater" (soft max). set_linear_damp
  // (:1248-1249) is `ERR_FAIL_COND(p_linear_damp < 0)`: the floor is enforced.
  linear_damp: v.float('linear_damp', { min: 0, enforced: 'physical_bone_3d.cpp:1249' }),
  // physical_bone_3d.cpp:904 — PROPERTY_HINT_ENUM "Combine,Replace". set_angular_damp_mode
  // is a bare assignment, so out-of-range warns.
  angular_damp_mode: v.enumInt('angular_damp_mode', 0, 1, DAMP_MODE, {
    hinted: 'physical_bone_3d.cpp:904',
  }),
  // physical_bone_3d.cpp:905 hints "0,100,0.001,or_greater" (soft max). set_angular_damp
  // (:1259-1260) is `ERR_FAIL_COND(p_angular_damp < 0)`: the floor is enforced.
  angular_damp: v.float('angular_damp', { min: 0, enforced: 'physical_bone_3d.cpp:1260' }),
  // physical_bone_3d.cpp:906 — Vector3, PROPERTY_HINT_NONE (format only, "suffix:m/s")
  linear_velocity: v.vector3('linear_velocity'),
  // physical_bone_3d.cpp:907 — Vector3, PROPERTY_HINT_NONE (format only, radians_as_degrees display)
  angular_velocity: v.vector3('angular_velocity'),
  // physical_bone_3d.cpp:908
  can_sleep: v.boolean('can_sleep'),

  'joint_constraints/*': jointConstraintsValidator,
});
