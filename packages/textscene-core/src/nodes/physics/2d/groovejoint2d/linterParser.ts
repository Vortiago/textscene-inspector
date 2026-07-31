/**
 * GrooveJoint2D strict validators for linting.
 *
 * Declare only GrooveJoint2D's OWN members — the ones doc/classes/GrooveJoint2D.xml
 * lists without an `overrides=` attribute. Everything from Joint2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * doc/classes/GrooveJoint2D.xml declares 2 members, neither carrying `overrides=`,
 * and groove_joint_2d.cpp's ADD_PROPERTY list matches it exactly — both have a
 * non-empty setter, so both are serialised and validated here.
 */

import '../../joints/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('GrooveJoint2D', {
  // scene/2d/physics/joints/groove_joint_2d.cpp: ADD_PROPERTY(PropertyInfo(Variant::FLOAT,
  // "length", PROPERTY_HINT_RANGE, "1,65535,1,exp,suffix:px"), ...) — no `,or_greater`/
  // `,or_less`, so 1 and 65535 are the hard bounds, not editor-soft ones.
  length: v.float('length', { min: 1, max: 65535 }),
  // scene/2d/physics/joints/groove_joint_2d.cpp: ADD_PROPERTY(PropertyInfo(Variant::FLOAT,
  // "initial_offset", PROPERTY_HINT_RANGE, "1,65535,1,exp,suffix:px"), ...) — same hint,
  // same hard bounds.
  initial_offset: v.float('initial_offset', { min: 1, max: 65535 }),
});
