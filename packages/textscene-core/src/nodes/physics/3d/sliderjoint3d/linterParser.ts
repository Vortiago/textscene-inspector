/**
 * SliderJoint3D strict validators for linting.
 *
 * Declare only SliderJoint3D's OWN members - the ones doc/classes/SliderJoint3D.xml
 * lists without an `overrides=` attribute. Everything from Joint3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * All 22 members come straight from `slider_joint_3d.cpp`'s `_bind_methods`,
 * every one an `ADD_PROPERTYI` with both a setter and a getter (no
 * `PROPERTY_USAGE_NONE`, no getter-only entry), so none is skipped on rules 3/4.
 *
 * Six fixed-size Godot property groups (`linear_limit/*`, `linear_motion/*`,
 * `linear_ortho/*`, `angular_limit/*`, `angular_motion/*`, `angular_ortho/*`),
 * each a small closed set the engine never grows at runtime - unlike
 * PhysicalBone3D's per-joint-type `joint_constraints/...`, which genuinely
 * needs a wildcard dispatch table. Enumerated directly, same shape as
 * HingeJoint3D's `angular_limit/*` + `motor/*`.
 */

import '../../joints/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('SliderJoint3D', {
  // slider_joint_3d.cpp:37 - PROPERTY_HINT_RANGE "-1024,1024,0.01,suffix:m", no or_greater/or_less: both bounds hard.
  'linear_limit/upper_distance': v.float('linear_limit/upper_distance', { min: -1024, max: 1024 }),
  // slider_joint_3d.cpp:38 - same hint shape as upper_distance.
  'linear_limit/lower_distance': v.float('linear_limit/lower_distance', { min: -1024, max: 1024 }),
  // slider_joint_3d.cpp:39 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  'linear_limit/softness': v.float('linear_limit/softness', { min: 0.01, max: 16.0 }),
  // slider_joint_3d.cpp:40 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  'linear_limit/restitution': v.float('linear_limit/restitution', { min: 0.01, max: 16.0 }),
  // slider_joint_3d.cpp:41 - PROPERTY_HINT_RANGE "0,16.0,0.01", both bounds hard.
  'linear_limit/damping': v.float('linear_limit/damping', { min: 0, max: 16.0 }),

  // slider_joint_3d.cpp:42 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  'linear_motion/softness': v.float('linear_motion/softness', { min: 0.01, max: 16.0 }),
  // slider_joint_3d.cpp:43 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  'linear_motion/restitution': v.float('linear_motion/restitution', { min: 0.01, max: 16.0 }),
  // slider_joint_3d.cpp:44 - PROPERTY_HINT_RANGE "0,16.0,0.01", both bounds hard.
  'linear_motion/damping': v.float('linear_motion/damping', { min: 0, max: 16.0 }),

  // slider_joint_3d.cpp:45 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  'linear_ortho/softness': v.float('linear_ortho/softness', { min: 0.01, max: 16.0 }),
  // slider_joint_3d.cpp:46 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  'linear_ortho/restitution': v.float('linear_ortho/restitution', { min: 0.01, max: 16.0 }),
  // slider_joint_3d.cpp:47 - PROPERTY_HINT_RANGE "0,16.0,0.01", both bounds hard.
  'linear_ortho/damping': v.float('linear_ortho/damping', { min: 0, max: 16.0 }),

  // slider_joint_3d.cpp:49 - PROPERTY_HINT_RANGE "-180,180,0.1,radians_as_degrees",
  // no or_greater/or_less. The hint's degrees describe the inspector slider;
  // the value serialised into a .tscn is radians, so the hard bound is ±π
  // radians, not ±180 (same hint shape HingeJoint3D's angular_limit/upper uses).
  'angular_limit/upper_angle': v.radians('angular_limit/upper_angle', { minDeg: -180, maxDeg: 180 }),
  // slider_joint_3d.cpp:50 - same hint shape as upper_angle.
  'angular_limit/lower_angle': v.radians('angular_limit/lower_angle', { minDeg: -180, maxDeg: 180 }),
  // slider_joint_3d.cpp:51 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  'angular_limit/softness': v.float('angular_limit/softness', { min: 0.01, max: 16.0 }),
  // slider_joint_3d.cpp:52 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  'angular_limit/restitution': v.float('angular_limit/restitution', { min: 0.01, max: 16.0 }),
  // slider_joint_3d.cpp:53 - PROPERTY_HINT_RANGE "0,16.0,0.01", both bounds hard.
  'angular_limit/damping': v.float('angular_limit/damping', { min: 0, max: 16.0 }),

  // slider_joint_3d.cpp:54 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  'angular_motion/softness': v.float('angular_motion/softness', { min: 0.01, max: 16.0 }),
  // slider_joint_3d.cpp:55 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  'angular_motion/restitution': v.float('angular_motion/restitution', { min: 0.01, max: 16.0 }),
  // slider_joint_3d.cpp:56 - PROPERTY_HINT_RANGE "0,16.0,0.01", both bounds hard.
  'angular_motion/damping': v.float('angular_motion/damping', { min: 0, max: 16.0 }),

  // slider_joint_3d.cpp:57 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  'angular_ortho/softness': v.float('angular_ortho/softness', { min: 0.01, max: 16.0 }),
  // slider_joint_3d.cpp:58 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  'angular_ortho/restitution': v.float('angular_ortho/restitution', { min: 0.01, max: 16.0 }),
  // slider_joint_3d.cpp:59 - PROPERTY_HINT_RANGE "0,16.0,0.01", both bounds hard.
  'angular_ortho/damping': v.float('angular_ortho/damping', { min: 0, max: 16.0 }),
});
