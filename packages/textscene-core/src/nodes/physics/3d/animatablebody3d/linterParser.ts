/**
 * AnimatableBody3D strict validators for linting.
 *
 * Declare only AnimatableBody3D's OWN members: the ones doc/classes/AnimatableBody3D.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../staticbody3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('AnimatableBody3D', {
  // scene/3d/physics/animatable_body_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "sync_to_physics"), "set_sync_to_physics", "is_sync_to_physics_enabled")
  sync_to_physics: v.boolean('sync_to_physics'),
});
