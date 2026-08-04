/**
 * RayCast2D strict validators for linting.
 *
 * Declare only RayCast2D's OWN members — the ones doc/classes/RayCast2D.xml
 * lists without an `overrides=` attribute. Everything from Node2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('RayCast2D', {
  enabled: v.boolean('enabled'),
  exclude_parent: v.boolean('exclude_parent'),
  target_position: v.vector2('target_position'),
  // scene/2d/physics/ray_cast_2d.cpp: ADD_PROPERTY(..., "collision_mask", PROPERTY_HINT_LAYERS_2D_PHYSICS)
  collision_mask: layerBitmask('collision_mask', { hinted: 'ray_cast_2d.cpp:364' }),
  hit_from_inside: v.boolean('hit_from_inside'),
  collide_with_areas: v.boolean('collide_with_areas'),
  collide_with_bodies: v.boolean('collide_with_bodies'),
});
