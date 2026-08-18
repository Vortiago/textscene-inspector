/**
 * RayCast3D strict validators for linting.
 *
 * Declare only RayCast3D's OWN members — the ones doc/classes/RayCast3D.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('RayCast3D', {
  enabled: v.boolean('enabled'),
  exclude_parent: v.boolean('exclude_parent'),
  // scene/3d/physics/ray_cast_3d.cpp:379: PROPERTY_HINT_NONE, "suffix:m" — a unit
  // display hint, not a range; only the Vector3 format is enforceable.
  target_position: v.vector3('target_position'),
  // scene/3d/physics/ray_cast_3d.cpp:380: PROPERTY_HINT_LAYERS_3D_PHYSICS
  collision_mask: layerBitmask('collision_mask', { hinted: 'ray_cast_3d.cpp:380', width: 'uint32' /* ray_cast_3d.h:100 */ }),
  hit_from_inside: v.boolean('hit_from_inside'),
  hit_back_faces: v.boolean('hit_back_faces'),
  collide_with_areas: v.boolean('collide_with_areas'),
  collide_with_bodies: v.boolean('collide_with_bodies'),
  debug_shape_custom_color: v.color('debug_shape_custom_color'),
  // scene/3d/physics/ray_cast_3d.cpp:390: PROPERTY_HINT_RANGE, "1,5". The setter
  // is a bare assignment, so out-of-range warns.
  debug_shape_thickness: v.int('debug_shape_thickness', {
    min: 1,
    max: 5,
    hinted: 'ray_cast_3d.cpp:390',
  }),
});
