/**
 * PinJoint2D strict validators for linting.
 *
 * Declare only PinJoint2D's OWN members, the ones doc/classes/PinJoint2D.xml
 * lists without an `overrides=` attribute. Everything from Joint2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../joints/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// pin_joint_2d.cpp:169-170 ADD_PROPERTY: PROPERTY_HINT_RANGE "-180,180,0.1,radians_as_degrees",
// no or_greater/or_less. The hint's degrees describe the inspector slider; the
// value serialised into a .tscn is radians (bare `real_t` fields, plain
// assignment setters), so the hard bound is +/-pi radians, not +/-180. The small
// epsilon absorbs float round-trip through the degrees<->radians conversion,
// the same technique VehicleBody3D's `steering` uses for the identical hint shape.
const PI_PLUS_EPSILON = Math.PI + 0.0001;

validatorRegistry.registerAll('PinJoint2D', {
  // pin_joint_2d.cpp:166, PROPERTY_HINT_RANGE "0.00,16,0.01,exp", no or_greater: both bounds hard.
  softness: v.float('softness', { min: 0, max: 16 }),
  // pin_joint_2d.cpp:168, PROPERTY_HINT_GROUP_ENABLE, a plain bool field/setter.
  angular_limit_enabled: v.boolean('angular_limit_enabled'),
  angular_limit_lower: v.float('angular_limit_lower', {
    min: -PI_PLUS_EPSILON,
    max: PI_PLUS_EPSILON,
    message: `Property 'angular_limit_lower' must be between ${(-Math.PI).toFixed(4)} and ${Math.PI.toFixed(4)} radians (-180 to 180 degrees)`,
  }),
  angular_limit_upper: v.float('angular_limit_upper', {
    min: -PI_PLUS_EPSILON,
    max: PI_PLUS_EPSILON,
    message: `Property 'angular_limit_upper' must be between ${(-Math.PI).toFixed(4)} and ${Math.PI.toFixed(4)} radians (-180 to 180 degrees)`,
  }),
  // pin_joint_2d.cpp:172, PROPERTY_HINT_GROUP_ENABLE, a plain bool field/setter.
  motor_enabled: v.boolean('motor_enabled'),
  // pin_joint_2d.cpp:173, PROPERTY_HINT_RANGE "-200,200,0.01,or_greater,or_less,radians_as_degrees,...".
  // or_greater/or_less make both bounds soft editor extents, not an enforced
  // range: the setter assigns the value straight through, so any finite float
  // is valid regardless of the radians_as_degrees display hint.
  motor_target_velocity: v.float('motor_target_velocity'),
});
