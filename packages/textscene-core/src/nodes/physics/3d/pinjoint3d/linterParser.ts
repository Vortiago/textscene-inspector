/**
 * PinJoint3D strict validators for linting.
 *
 * Declare only PinJoint3D's OWN members — the ones doc/classes/PinJoint3D.xml
 * lists without an `overrides=` attribute. Everything from Joint3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../joints/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// pin_joint_3d.cpp:46-52, PinJoint3D::set_param: `ERR_FAIL_INDEX(p_param, 3)`
// guards the Param enum index, not the value; every param is a bare
// `params[p_param] = p_value` beyond that. So all three below are hinted.
validatorRegistry.registerAll('PinJoint3D', {
  // pin_joint_3d.cpp:37 — PROPERTY_HINT_RANGE "0.01,0.99,0.01", no or_greater/or_less.
  'params/bias': v.float('params/bias', { min: 0.01, max: 0.99, hinted: 'pin_joint_3d.cpp:37' }),
  // pin_joint_3d.cpp:38 — PROPERTY_HINT_RANGE "0.01,8.0,0.01", no or_greater/or_less.
  'params/damping': v.float('params/damping', { min: 0.01, max: 8.0, hinted: 'pin_joint_3d.cpp:38' }),
  // pin_joint_3d.cpp:39 — PROPERTY_HINT_RANGE "0.0,64.0,0.01", no or_greater/or_less.
  'params/impulse_clamp': v.float('params/impulse_clamp', {
    min: 0.0,
    max: 64.0,
    hinted: 'pin_joint_3d.cpp:39',
  }),
});
