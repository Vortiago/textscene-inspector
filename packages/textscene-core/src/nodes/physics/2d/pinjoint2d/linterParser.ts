/**
 * PinJoint2D strict validators: only the members doc/classes/PinJoint2D.xml lists without
 * `overrides=`. The NODE_BASE_TYPES base-walk delivers everything from Joint2D up, and a
 * re-declared key shadows it.
 */

import '../../joints/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('PinJoint2D', {
  // pin_joint_2d.cpp:166, PROPERTY_HINT_RANGE "0.00,16,0.01,exp", no or_greater.
  // set_softness (:62-71) is a bare assignment, so out-of-range warns.
  softness: v.float('softness', { min: 0, max: 16, hinted: 'pin_joint_2d.cpp:166' }),
  // pin_joint_2d.cpp:168, PROPERTY_HINT_GROUP_ENABLE, a plain bool field/setter.
  angular_limit_enabled: v.boolean('angular_limit_enabled'),
  // pin_joint_2d.cpp:169-170, PROPERTY_HINT_RANGE "-180,180,0.1,radians_as_degrees",
  // no or_greater. The named setters (:77-101) are bare assignments, so
  // out-of-range warns.
  angular_limit_lower: v.radians('angular_limit_lower', {
    minDeg: -180,
    maxDeg: 180,
    hinted: 'pin_joint_2d.cpp:169',
  }),
  angular_limit_upper: v.radians('angular_limit_upper', {
    minDeg: -180,
    maxDeg: 180,
    hinted: 'pin_joint_2d.cpp:170',
  }),
  // pin_joint_2d.cpp:172, PROPERTY_HINT_GROUP_ENABLE, a plain bool field/setter.
  motor_enabled: v.boolean('motor_enabled'),
  // pin_joint_2d.cpp:173, PROPERTY_HINT_RANGE "-200,200,0.01,or_greater,or_less,radians_as_degrees,...".
  // or_greater/or_less make both bounds soft editor extents, and the setter assigns the
  // value straight through, so any finite float is valid.
  motor_target_velocity: v.float('motor_target_velocity'),
});
