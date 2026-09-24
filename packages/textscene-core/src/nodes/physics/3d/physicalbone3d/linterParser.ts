/**
 * PhysicalBone3D strict validators: the members doc/classes/PhysicalBone3D.xml lists without
 * `overrides=`, plus `bone_name` and `joint_constraints/...` (jointConstraints.ts), which only
 * `_get_property_list`/`_set`/`_get` serialise. The NODE_BASE_TYPES base-walk delivers everything
 * from Node3D up, `axis_lock_*` included, and a re-declared key shadows it.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { jointConstraintsValidator } from './jointConstraints.js';

// physical_bone_3d.cpp:891, 913-918: 6 BIND_ENUM_CONSTANT (JOINT_TYPE_NONE..JOINT_TYPE_6DOF)
const JOINT_TYPE = { 0: 'NONE', 1: 'PIN', 2: 'CONE', 3: 'HINGE', 4: 'SLIDER', 5: '6DOF' };
// physical_bone_3d.cpp:902,904,910-911: 2 BIND_ENUM_CONSTANT (DAMP_MODE_COMBINE/REPLACE)
const DAMP_MODE = { 0: 'COMBINE', 1: 'REPLACE' };

validatorRegistry.registerAll('PhysicalBone3D', {
  // physical_bone_3d.cpp:709-745: virtual STRING_NAME property (_get_property_list/
  // _set/_get), not an ADD_PROPERTY, and not in doc/classes/PhysicalBone3D.xml. Bone names
  // come from the parent Skeleton3D at runtime, so only the StringName format is checked.
  bone_name: v.stringName('bone_name'),

  // physical_bone_3d.cpp:891: PROPERTY_HINT_ENUM "None,PinJoint,ConeJoint,HingeJoint,SliderJoint,6DOFJoint".
  // set_joint_type (:1088-1113) switches over the enum with no default case
  // and no ERR_FAIL: an out-of-range value is inert, not guarded, so this is hinted.
  joint_type: v.enumInt('joint_type', 0, 5, JOINT_TYPE, { hinted: 'physical_bone_3d.cpp:891' }),
  // physical_bone_3d.cpp:892: Transform3D, PROPERTY_HINT_NONE (format only, "suffix:m")
  joint_offset: v.transform3d('joint_offset'),
  // physical_bone_3d.cpp:893: PROPERTY_HINT_RANGE "-360,360,0.01,or_less,or_greater,radians_as_degrees":
  // both or_less and or_greater present, so both ends are soft editor bounds: unbounded.
  joint_rotation: v.vector3('joint_rotation'),
  // physical_bone_3d.cpp:895: Transform3D, PROPERTY_HINT_NONE (format only, "suffix:m")
  body_offset: v.transform3d('body_offset'),
  // physical_bone_3d.cpp:897 hints "0.01,1000,0.01,or_greater,exp,suffix:kg":
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
  // physical_bone_3d.cpp:900: PROPERTY_HINT_RANGE "-8,8,0.001,or_less,or_greater":
  // both or_less and or_greater present: unbounded.
  gravity_scale: v.float('gravity_scale'),
  // physical_bone_3d.cpp:901
  custom_integrator: v.boolean('custom_integrator'),
  // physical_bone_3d.cpp:902: PROPERTY_HINT_ENUM "Combine,Replace". set_linear_damp_mode
  // is a bare assignment, so out-of-range warns.
  linear_damp_mode: v.enumInt('linear_damp_mode', 0, 1, DAMP_MODE, {
    hinted: 'physical_bone_3d.cpp:902',
  }),
  // physical_bone_3d.cpp:903 hints "0,100,0.001,or_greater" (soft max). set_linear_damp
  // (:1248-1249) is `ERR_FAIL_COND(p_linear_damp < 0)`: the floor is enforced.
  linear_damp: v.float('linear_damp', { min: 0, enforced: 'physical_bone_3d.cpp:1249' }),
  // physical_bone_3d.cpp:904: PROPERTY_HINT_ENUM "Combine,Replace". set_angular_damp_mode
  // is a bare assignment, so out-of-range warns.
  angular_damp_mode: v.enumInt('angular_damp_mode', 0, 1, DAMP_MODE, {
    hinted: 'physical_bone_3d.cpp:904',
  }),
  // physical_bone_3d.cpp:905 hints "0,100,0.001,or_greater" (soft max). set_angular_damp
  // (:1259-1260) is `ERR_FAIL_COND(p_angular_damp < 0)`: the floor is enforced.
  angular_damp: v.float('angular_damp', { min: 0, enforced: 'physical_bone_3d.cpp:1260' }),
  // physical_bone_3d.cpp:906: Vector3, PROPERTY_HINT_NONE (format only, "suffix:m/s")
  linear_velocity: v.vector3('linear_velocity'),
  // physical_bone_3d.cpp:907: Vector3, PROPERTY_HINT_NONE (format only, radians_as_degrees display)
  angular_velocity: v.vector3('angular_velocity'),
  // physical_bone_3d.cpp:908
  can_sleep: v.boolean('can_sleep'),

  'joint_constraints/*': jointConstraintsValidator,
});
