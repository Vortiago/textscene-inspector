/**
 * SkeletonModifier3D strict validators for linting.
 *
 * Declare only SkeletonModifier3D's OWN members — the ones doc/classes/SkeletonModifier3D.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('SkeletonModifier3D', {
  active: v.boolean('active'),
  // scene/3d/skeleton_modifier_3d.cpp:161, ADD_PROPERTY(..., "influence",
  // PROPERTY_HINT_RANGE, "0,1,0.001"); set_influence (:111) is a bare assignment.
  influence: v.float('influence', { min: 0, max: 1, hinted: 'skeleton_modifier_3d.cpp:161' }),
});
