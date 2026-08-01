/**
 * ConeTwistJoint3D strict validators for linting.
 *
 * Declare only ConeTwistJoint3D's OWN members — the ones doc/classes/ConeTwistJoint3D.xml
 * lists without an `overrides=` attribute. Everything from Joint3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * All five members come straight from `cone_twist_joint_3d.cpp`'s `_bind_methods`,
 * every one an `ADD_PROPERTYI` with both a setter and a getter (no
 * `PROPERTY_USAGE_NONE`, no getter-only entry), so none is skipped on rules 3/4.
 */

import '../../joints/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('ConeTwistJoint3D', {
  // cone_twist_joint_3d.cpp:37 — PROPERTY_HINT_RANGE "-180,180,0.1,radians_as_degrees", no or_greater/or_less: hard bound of ±π radians once converted.
  swing_span: v.radians('swing_span', { minDeg: -180, maxDeg: 180 }),
  // cone_twist_joint_3d.cpp:38 — PROPERTY_HINT_RANGE "-40000,40000,0.1,radians_as_degrees", no or_greater/or_less: the huge extent IS the hard bound (±40000° converted to radians).
  twist_span: v.radians('twist_span', { minDeg: -40000, maxDeg: 40000 }),
  // cone_twist_joint_3d.cpp:40 — PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  bias: v.float('bias', { min: 0.01, max: 16.0 }),
  // cone_twist_joint_3d.cpp:41 — PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  softness: v.float('softness', { min: 0.01, max: 16.0 }),
  // cone_twist_joint_3d.cpp:42 — PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  relaxation: v.float('relaxation', { min: 0.01, max: 16.0 }),
});
