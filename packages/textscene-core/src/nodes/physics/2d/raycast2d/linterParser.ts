/**
 * RayCast2D strict validators: only the members doc/classes/RayCast2D.xml lists without
 * `overrides=`. The NODE_BASE_TYPES base-walk delivers everything from Node2D up, and a
 * re-declared key shadows it.
 */

import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('RayCast2D', {
  enabled: v.boolean('enabled'),
  exclude_parent: v.boolean('exclude_parent'),
  target_position: v.vector2('target_position'),
  // scene/2d/physics/ray_cast_2d.cpp: ADD_PROPERTY(..., "collision_mask", PROPERTY_HINT_LAYERS_2D_PHYSICS)
  collision_mask: layerBitmask('collision_mask', { hinted: 'ray_cast_2d.cpp:364', width: 'uint32' /* ray_cast_2d.h:81 */ }),
  hit_from_inside: v.boolean('hit_from_inside'),
  collide_with_areas: v.boolean('collide_with_areas'),
  collide_with_bodies: v.boolean('collide_with_bodies'),
});
