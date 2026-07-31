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

validatorRegistry.registerAll('PinJoint3D', {
  // pin_joint_3d.cpp:37 — PROPERTY_HINT_RANGE "0.01,0.99,0.01", no or_greater/or_less: both bounds hard.
  'params/bias': v.float('params/bias', { min: 0.01, max: 0.99 }),
  // pin_joint_3d.cpp:38 — PROPERTY_HINT_RANGE "0.01,8.0,0.01", no or_greater/or_less: both bounds hard.
  'params/damping': v.float('params/damping', { min: 0.01, max: 8.0 }),
  // pin_joint_3d.cpp:39 — PROPERTY_HINT_RANGE "0.0,64.0,0.01", no or_greater/or_less: both bounds hard.
  'params/impulse_clamp': v.float('params/impulse_clamp', { min: 0.0, max: 64.0 }),
});
