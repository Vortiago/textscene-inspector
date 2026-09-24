/**
 * HingeJoint3D strict validators: the ten members doc/classes/HingeJoint3D.xml lists without
 * `overrides=`, each an `ADD_PROPERTYI` with a setter and a getter in `hinge_joint_3d.cpp`'s
 * `_bind_methods`. The NODE_BASE_TYPES base-walk delivers everything from Joint3D up, and a
 * re-declared key shadows it.
 */

// The `angular_limit/*` and `motor/*` groups are small and fixed, so their keys are listed
// directly, not routed through a wildcard dispatch table.

import '../../joints/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// HingeJoint3D::set_param (hinge_joint_3d.cpp:68-70) is
// `ERR_FAIL_INDEX(p_param, PARAM_MAX)` guarding the Param enum index, then a
// bare `params[p_param] = p_value`, so every params/angular_limit/motor
// float below is hinted, not enforced.
validatorRegistry.registerAll('HingeJoint3D', {
  // hinge_joint_3d.cpp:40: PROPERTY_HINT_RANGE "0.00,0.99,0.01".
  'params/bias': v.float('params/bias', { min: 0, max: 0.99, hinted: 'hinge_joint_3d.cpp:40' }),

  // hinge_joint_3d.cpp:42: plain BOOL, no hint (set_flag/get_flag on FLAG_USE_LIMIT).
  'angular_limit/enable': v.boolean('angular_limit/enable'),
  // hinge_joint_3d.cpp:43-44, PROPERTY_HINT_RANGE "-180,180,0.1,radians_as_degrees", no or_greater.
  'angular_limit/upper': v.radians('angular_limit/upper', {
    minDeg: -180,
    maxDeg: 180,
    hinted: 'hinge_joint_3d.cpp:43',
  }),
  'angular_limit/lower': v.radians('angular_limit/lower', {
    minDeg: -180,
    maxDeg: 180,
    hinted: 'hinge_joint_3d.cpp:44',
  }),
  // hinge_joint_3d.cpp:45: PROPERTY_HINT_RANGE "0.01,0.99,0.01".
  'angular_limit/bias': v.float('angular_limit/bias', {
    min: 0.01,
    max: 0.99,
    hinted: 'hinge_joint_3d.cpp:45',
  }),
  // hinge_joint_3d.cpp:46: PROPERTY_HINT_RANGE "0.01,16,0.01".
  // Deprecated in the XML (never set by the engine itself) but, with no `overrides=`, still
  // this class's own ADD_PROPERTY.
  'angular_limit/softness': v.float('angular_limit/softness', {
    min: 0.01,
    max: 16,
    hinted: 'hinge_joint_3d.cpp:46',
  }),
  // hinge_joint_3d.cpp:47: PROPERTY_HINT_RANGE "0.01,16,0.01".
  'angular_limit/relaxation': v.float('angular_limit/relaxation', {
    min: 0.01,
    max: 16,
    hinted: 'hinge_joint_3d.cpp:47',
  }),

  // hinge_joint_3d.cpp:49: plain BOOL, no hint (set_flag/get_flag on FLAG_ENABLE_MOTOR).
  'motor/enable': v.boolean('motor/enable'),
  // hinge_joint_3d.cpp:50: PROPERTY_HINT_RANGE
  // "-200,200,0.01,or_greater,or_less,radians_as_degrees,suffix:°/s". Both or_greater and
  // or_less are present, so -200/200 are only slider extents, and the setter assigns with no
  // clamp: any finite float is legal.
  'motor/target_velocity': v.float('motor/target_velocity'),
  // hinge_joint_3d.cpp:51: PROPERTY_HINT_RANGE "0.01,1024,0.01".
  'motor/max_impulse': v.float('motor/max_impulse', {
    min: 0.01,
    max: 1024,
    hinted: 'hinge_joint_3d.cpp:51',
  }),
});
