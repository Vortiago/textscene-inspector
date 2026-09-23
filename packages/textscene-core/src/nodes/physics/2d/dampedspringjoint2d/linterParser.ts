/**
 * DampedSpringJoint2D strict validators: only the members doc/classes/DampedSpringJoint2D.xml
 * lists without `overrides=`. The NODE_BASE_TYPES base-walk delivers everything from Joint2D up,
 * and a re-declared key shadows it.
 */

import '../../joints/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// Every setter below (damped_spring_joint_2d.cpp:63-105) is a bare field
// assignment, so all four bounds are hinted, not enforced.
validatorRegistry.registerAll('DampedSpringJoint2D', {
  // damped_spring_joint_2d.cpp:121, PROPERTY_HINT_RANGE, "1,65535,1,exp,suffix:px", no or_greater
  length: v.float('length', { min: 1, max: 65535, hinted: 'damped_spring_joint_2d.cpp:121' }),
  // damped_spring_joint_2d.cpp:122, PROPERTY_HINT_RANGE, "0,65535,1,exp,suffix:px", no or_greater
  rest_length: v.float('rest_length', {
    min: 0,
    max: 65535,
    hinted: 'damped_spring_joint_2d.cpp:122',
  }),
  // damped_spring_joint_2d.cpp:123, PROPERTY_HINT_RANGE, "0.1,64,0.1,exp", no or_greater
  stiffness: v.float('stiffness', { min: 0.1, max: 64, hinted: 'damped_spring_joint_2d.cpp:123' }),
  // damped_spring_joint_2d.cpp:124, PROPERTY_HINT_RANGE, "0.01,16,0.01,exp", no or_greater
  damping: v.float('damping', { min: 0.01, max: 16, hinted: 'damped_spring_joint_2d.cpp:124' }),
});
