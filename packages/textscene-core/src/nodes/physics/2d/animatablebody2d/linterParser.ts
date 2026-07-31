/**
 * AnimatableBody2D strict validators for linting.
 *
 * Declare only AnimatableBody2D's OWN members: the ones doc/classes/AnimatableBody2D.xml
 * lists without an `overrides=` attribute. Everything from StaticBody2D
 * (physics_material_override, constant_linear_velocity, constant_angular_velocity),
 * the CollisionObject2D tier (disable_mode, collision_layer, collision_mask,
 * collision_priority, input_pickable), Node2D and CanvasItem is registered on
 * those ancestors and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * AnimatableBody2D's own surface is exactly one property,
 * `sync_to_physics`: scene/2d/physics/animatable_body_2d.cpp,
 * `ADD_PROPERTY(PropertyInfo(Variant::BOOL, "sync_to_physics"),
 * "set_sync_to_physics", "is_sync_to_physics_enabled")`, a plain bool, no
 * hint, both setter and getter present.
 */

import '../staticbody2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('AnimatableBody2D', {
  sync_to_physics: v.boolean('sync_to_physics'),
});
