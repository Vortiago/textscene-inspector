/**
 * DampedSpringJoint2D strict validators for linting.
 *
 * Declare only DampedSpringJoint2D's OWN members — the ones doc/classes/DampedSpringJoint2D.xml
 * lists without an `overrides=` attribute. Everything from Joint2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../joints/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('DampedSpringJoint2D', {
  // damped_spring_joint_2d.cpp:121, PROPERTY_HINT_RANGE, "1,65535,1,exp,suffix:px", no or_greater: both bounds hard
  length: v.float('length', { min: 1, max: 65535 }),
  // damped_spring_joint_2d.cpp:122, PROPERTY_HINT_RANGE, "0,65535,1,exp,suffix:px", no or_greater: both bounds hard
  rest_length: v.float('rest_length', { min: 0, max: 65535 }),
  // damped_spring_joint_2d.cpp:123, PROPERTY_HINT_RANGE, "0.1,64,0.1,exp", no or_greater: both bounds hard
  stiffness: v.float('stiffness', { min: 0.1, max: 64 }),
  // damped_spring_joint_2d.cpp:124, PROPERTY_HINT_RANGE, "0.01,16,0.01,exp", no or_greater: both bounds hard
  damping: v.float('damping', { min: 0.01, max: 16 }),
});
