/**
 * SliderJoint3D strict validators: the 22 members doc/classes/SliderJoint3D.xml lists without
 * `overrides=`, each an `ADD_PROPERTYI` with a setter and a getter in `slider_joint_3d.cpp`'s
 * `_bind_methods`. The NODE_BASE_TYPES base-walk delivers everything from Joint3D up, and a
 * re-declared key shadows it.
 */

// The six `linear_*/*` and `angular_*/*` groups are small and fixed, so their keys are listed
// directly, as in HingeJoint3D, not routed through a wildcard dispatch table.

import '../../joints/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// SliderJoint3D::set_param (slider_joint_3d.cpp:88-90) is
// `ERR_FAIL_INDEX(p_param, PARAM_MAX)` guarding the Param enum index, then a
// bare `params[p_param] = p_value`, so every one of the 22 bounds below is
// hinted, not enforced.
validatorRegistry.registerAll('SliderJoint3D', {
  // slider_joint_3d.cpp:37: PROPERTY_HINT_RANGE "-1024,1024,0.01,suffix:m", no or_greater/or_less.
  'linear_limit/upper_distance': v.float('linear_limit/upper_distance', {
    min: -1024,
    max: 1024,
    hinted: 'slider_joint_3d.cpp:37',
  }),
  // slider_joint_3d.cpp:38: same hint shape as upper_distance.
  'linear_limit/lower_distance': v.float('linear_limit/lower_distance', {
    min: -1024,
    max: 1024,
    hinted: 'slider_joint_3d.cpp:38',
  }),
  // slider_joint_3d.cpp:39: PROPERTY_HINT_RANGE "0.01,16.0,0.01".
  'linear_limit/softness': v.float('linear_limit/softness', {
    min: 0.01,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:39',
  }),
  // slider_joint_3d.cpp:40: PROPERTY_HINT_RANGE "0.01,16.0,0.01".
  'linear_limit/restitution': v.float('linear_limit/restitution', {
    min: 0.01,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:40',
  }),
  // slider_joint_3d.cpp:41: PROPERTY_HINT_RANGE "0,16.0,0.01".
  'linear_limit/damping': v.float('linear_limit/damping', {
    min: 0,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:41',
  }),

  // slider_joint_3d.cpp:42: PROPERTY_HINT_RANGE "0.01,16.0,0.01".
  'linear_motion/softness': v.float('linear_motion/softness', {
    min: 0.01,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:42',
  }),
  // slider_joint_3d.cpp:43: PROPERTY_HINT_RANGE "0.01,16.0,0.01".
  'linear_motion/restitution': v.float('linear_motion/restitution', {
    min: 0.01,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:43',
  }),
  // slider_joint_3d.cpp:44: PROPERTY_HINT_RANGE "0,16.0,0.01".
  'linear_motion/damping': v.float('linear_motion/damping', {
    min: 0,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:44',
  }),

  // slider_joint_3d.cpp:45: PROPERTY_HINT_RANGE "0.01,16.0,0.01".
  'linear_ortho/softness': v.float('linear_ortho/softness', {
    min: 0.01,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:45',
  }),
  // slider_joint_3d.cpp:46: PROPERTY_HINT_RANGE "0.01,16.0,0.01".
  'linear_ortho/restitution': v.float('linear_ortho/restitution', {
    min: 0.01,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:46',
  }),
  // slider_joint_3d.cpp:47: PROPERTY_HINT_RANGE "0,16.0,0.01".
  'linear_ortho/damping': v.float('linear_ortho/damping', {
    min: 0,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:47',
  }),

  // slider_joint_3d.cpp:49: PROPERTY_HINT_RANGE "-180,180,0.1,radians_as_degrees",
  // no or_greater/or_less. The hint's degrees describe the inspector slider, and
  // the .tscn stores radians, so the bound is ±π radians, not ±180.
  'angular_limit/upper_angle': v.radians('angular_limit/upper_angle', {
    minDeg: -180,
    maxDeg: 180,
    hinted: 'slider_joint_3d.cpp:49',
  }),
  // slider_joint_3d.cpp:50: same hint shape as upper_angle.
  'angular_limit/lower_angle': v.radians('angular_limit/lower_angle', {
    minDeg: -180,
    maxDeg: 180,
    hinted: 'slider_joint_3d.cpp:50',
  }),
  // slider_joint_3d.cpp:51: PROPERTY_HINT_RANGE "0.01,16.0,0.01".
  'angular_limit/softness': v.float('angular_limit/softness', {
    min: 0.01,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:51',
  }),
  // slider_joint_3d.cpp:52: PROPERTY_HINT_RANGE "0.01,16.0,0.01".
  'angular_limit/restitution': v.float('angular_limit/restitution', {
    min: 0.01,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:52',
  }),
  // slider_joint_3d.cpp:53: PROPERTY_HINT_RANGE "0,16.0,0.01".
  'angular_limit/damping': v.float('angular_limit/damping', {
    min: 0,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:53',
  }),

  // slider_joint_3d.cpp:54: PROPERTY_HINT_RANGE "0.01,16.0,0.01".
  'angular_motion/softness': v.float('angular_motion/softness', {
    min: 0.01,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:54',
  }),
  // slider_joint_3d.cpp:55: PROPERTY_HINT_RANGE "0.01,16.0,0.01".
  'angular_motion/restitution': v.float('angular_motion/restitution', {
    min: 0.01,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:55',
  }),
  // slider_joint_3d.cpp:56: PROPERTY_HINT_RANGE "0,16.0,0.01".
  'angular_motion/damping': v.float('angular_motion/damping', {
    min: 0,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:56',
  }),

  // slider_joint_3d.cpp:57: PROPERTY_HINT_RANGE "0.01,16.0,0.01".
  'angular_ortho/softness': v.float('angular_ortho/softness', {
    min: 0.01,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:57',
  }),
  // slider_joint_3d.cpp:58: PROPERTY_HINT_RANGE "0.01,16.0,0.01".
  'angular_ortho/restitution': v.float('angular_ortho/restitution', {
    min: 0.01,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:58',
  }),
  // slider_joint_3d.cpp:59: PROPERTY_HINT_RANGE "0,16.0,0.01".
  'angular_ortho/damping': v.float('angular_ortho/damping', {
    min: 0,
    max: 16.0,
    hinted: 'slider_joint_3d.cpp:59',
  }),
});
