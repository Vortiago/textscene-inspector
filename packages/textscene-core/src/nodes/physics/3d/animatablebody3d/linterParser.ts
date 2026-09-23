/**
 * AnimatableBody3D strict validators: only the members doc/classes/AnimatableBody3D.xml lists
 * without `overrides=`. The NODE_BASE_TYPES base-walk delivers everything from Node3D up, and a
 * re-declared key shadows it.
 */

import '../staticbody3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('AnimatableBody3D', {
  // scene/3d/physics/animatable_body_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "sync_to_physics"), "set_sync_to_physics", "is_sync_to_physics_enabled")
  sync_to_physics: v.boolean('sync_to_physics'),
});
