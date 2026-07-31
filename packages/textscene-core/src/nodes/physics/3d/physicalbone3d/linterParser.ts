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
import { v, accepts, propertyError } from '../../../../linter/validators/index.js';
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
const JOINT_CONSTRAINT_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // PinJointData::_get_property_list — physical_bone_3d.cpp:160-162
  damping: v.float('damping', { min: 0.01, max: 8.0 }),
  impulse_clamp: v.float('impulse_clamp', { min: 0.0, max: 64.0 }),
  // bias: union of PinJointData (0.01-0.99, physical_bone_3d.cpp:160) and
  // ConeJointData (0.01-16.0, physical_bone_3d.cpp:235)
  bias: v.float('bias', { min: 0.01, max: 16.0 }),

  // ConeJointData::_get_property_list — physical_bone_3d.cpp:233-237
  swing_span: v.float('swing_span', { min: -180, max: 180 }),
  // twist_span hint carries both or_less and or_greater: both ends are soft
  // editor bounds, so the real value is unbounded (physical_bone_3d.cpp:234)
  twist_span: v.float('twist_span'),
  softness: v.float('softness', { min: 0.01, max: 16.0 }),
  relaxation: v.float('relaxation', { min: 0.01, max: 16.0 }),

  // HingeJointData::_get_property_list — physical_bone_3d.cpp:316-321 — the
  // enabled/upper/lower/softness leaves are shared verbatim (same bound) with
  // SliderJointData's angular_limit_* and SixDOFJointData's per-axis leaves.
  angular_limit_enabled: v.boolean('angular_limit_enabled'),
  angular_limit_upper: v.float('angular_limit_upper', { min: -180, max: 180 }),
  angular_limit_lower: v.float('angular_limit_lower', { min: -180, max: 180 }),
  angular_limit_bias: v.float('angular_limit_bias', { min: 0.01, max: 0.99 }),
  angular_limit_softness: v.float('angular_limit_softness', { min: 0.01, max: 16 }),
  angular_limit_relaxation: v.float('angular_limit_relaxation', { min: 0.01, max: 16 }),

  // SliderJointData::_get_property_list — physical_bone_3d.cpp:432-442
  // linear_limit_upper/lower carry NO PROPERTY_HINT_RANGE at all (not even a
  // soft one) in both SliderJointData and SixDOFJointData: unbounded.
  linear_limit_upper: v.float('linear_limit_upper'),
  linear_limit_lower: v.float('linear_limit_lower'),
  linear_limit_softness: v.float('linear_limit_softness', { min: 0.01, max: 16.0 }),
  linear_limit_restitution: v.float('linear_limit_restitution', { min: 0.01, max: 16.0 }),
  linear_limit_damping: v.float('linear_limit_damping', { min: 0, max: 16.0 }),
  angular_limit_restitution: v.float('angular_limit_restitution', { min: 0.01, max: 16.0 }),
  angular_limit_damping: v.float('angular_limit_damping', { min: 0, max: 16.0 }),

  // SixDOFJointData::_get_property_list per-axis leaves — physical_bone_3d.cpp:685-705
  // (angular_limit_enabled/upper/lower/softness above are this struct's leaves too)
  linear_limit_enabled: v.boolean('linear_limit_enabled'),
  linear_spring_enabled: v.boolean('linear_spring_enabled'),
  linear_spring_stiffness: v.float('linear_spring_stiffness'),
  linear_spring_damping: v.float('linear_spring_damping'),
  linear_equilibrium_point: v.float('linear_equilibrium_point'),
  linear_restitution: v.float('linear_restitution', { min: 0.01, max: 16 }),
  linear_damping: v.float('linear_damping', { min: 0.01, max: 16 }),
  angular_restitution: v.float('angular_restitution', { min: 0.01, max: 16 }),
  angular_damping: v.float('angular_damping', { min: 0.01, max: 16 }),
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
  const leaf = JOINT_CONSTRAINT_LEAVES[leafName];
  if (!leaf) {
    return propertyError(
      key,
      line,
      `Unknown joint constraint property: "${key}"`,
      'INVALID_JOINT_CONSTRAINTS_KEY'
    );
  }
  return leaf(key, value, line);
}, 'joint-type-dependent constraint (float or bool — see PinJointData/ConeJointData/HingeJointData/SliderJointData/SixDOFJointData)');

validatorRegistry.registerAll('PhysicalBone3D', {
  // physical_bone_3d.cpp:709-745 — virtual STRING_NAME property (_get_property_list/
  // _set/_get), not an ADD_PROPERTY; not in doc/classes/PhysicalBone3D.xml either.
  bone_name: v.stringName('bone_name'),

  // physical_bone_3d.cpp:891 — PROPERTY_HINT_ENUM "None,PinJoint,ConeJoint,HingeJoint,SliderJoint,6DOFJoint"
  joint_type: v.enumInt('joint_type', 0, 5, JOINT_TYPE),
  // physical_bone_3d.cpp:892 — Transform3D, PROPERTY_HINT_NONE (format only, "suffix:m")
  joint_offset: v.transform3d('joint_offset'),
  // physical_bone_3d.cpp:893 — PROPERTY_HINT_RANGE "-360,360,0.01,or_less,or_greater,radians_as_degrees":
  // both or_less and or_greater present, so both ends are soft editor bounds — unbounded.
  joint_rotation: v.vector3('joint_rotation'),
  // physical_bone_3d.cpp:895 — Transform3D, PROPERTY_HINT_NONE (format only, "suffix:m")
  body_offset: v.transform3d('body_offset'),
  // physical_bone_3d.cpp:897 — PROPERTY_HINT_RANGE "0.01,1000,0.01,or_greater,exp,suffix:kg":
  // or_greater makes 1000 a soft editor bound, but 0.01 has no or_less — hard min.
  mass: v.float('mass', { min: 0.01 }),
  // physical_bone_3d.cpp:898 — PROPERTY_HINT_RANGE "0,1,0.01", both bounds hard
  friction: v.float('friction', { min: 0, max: 1 }),
  // physical_bone_3d.cpp:899 — PROPERTY_HINT_RANGE "0,1,0.01", both bounds hard
  bounce: v.float('bounce', { min: 0, max: 1 }),
  // physical_bone_3d.cpp:900 — PROPERTY_HINT_RANGE "-8,8,0.001,or_less,or_greater":
  // both or_less and or_greater present — unbounded.
  gravity_scale: v.float('gravity_scale'),
  // physical_bone_3d.cpp:901
  custom_integrator: v.boolean('custom_integrator'),
  // physical_bone_3d.cpp:902 — PROPERTY_HINT_ENUM "Combine,Replace"
  linear_damp_mode: v.enumInt('linear_damp_mode', 0, 1, DAMP_MODE),
  // physical_bone_3d.cpp:903 — PROPERTY_HINT_RANGE "0,100,0.001,or_greater": hard min 0, soft max
  linear_damp: v.float('linear_damp', { min: 0 }),
  // physical_bone_3d.cpp:904 — PROPERTY_HINT_ENUM "Combine,Replace"
  angular_damp_mode: v.enumInt('angular_damp_mode', 0, 1, DAMP_MODE),
  // physical_bone_3d.cpp:905 — PROPERTY_HINT_RANGE "0,100,0.001,or_greater": hard min 0, soft max
  angular_damp: v.float('angular_damp', { min: 0 }),
  // physical_bone_3d.cpp:906 — Vector3, PROPERTY_HINT_NONE (format only, "suffix:m/s")
  linear_velocity: v.vector3('linear_velocity'),
  // physical_bone_3d.cpp:907 — Vector3, PROPERTY_HINT_NONE (format only, radians_as_degrees display)
  angular_velocity: v.vector3('angular_velocity'),
  // physical_bone_3d.cpp:908
  can_sleep: v.boolean('can_sleep'),

  'joint_constraints/*': jointConstraintsValidator,
});
