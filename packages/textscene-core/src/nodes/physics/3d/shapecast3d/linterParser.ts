/**
 * ShapeCast3D strict validators for linting.
 *
 * Declare only ShapeCast3D's OWN members — the ones doc/classes/ShapeCast3D.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `collision_result` (Array, getter `get_collision_result`, no setter) is
 * deliberately absent: scene/3d/physics/shape_cast_3d.cpp:172 binds it
 * `PROPERTY_HINT_NONE, "", PROPERTY_USAGE_NO_EDITOR` with an empty setter — a
 * runtime-computed collision report, never authored by hand, so it never
 * appears in a `.tscn` and gets no validator.
 */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('ShapeCast3D', {
  // scene/3d/physics/shape_cast_3d.cpp:165
  enabled: v.boolean('enabled'),
  // scene/3d/physics/shape_cast_3d.cpp:166 — PROPERTY_HINT_RESOURCE_TYPE, "Shape3D"
  shape: v.resourceReference('shape'),
  // scene/3d/physics/shape_cast_3d.cpp:167
  exclude_parent: v.boolean('exclude_parent'),
  // scene/3d/physics/shape_cast_3d.cpp:168 — PROPERTY_HINT_NONE, "suffix:m" (no range, just a unit hint)
  target_position: v.vector3('target_position'),
  // scene/3d/physics/shape_cast_3d.cpp:169 — PROPERTY_HINT_RANGE, "0,100,0.01,suffix:m" (no or_greater, so 100 is a hard cap)
  margin: v.float('margin', { min: 0, max: 100 }),
  // scene/3d/physics/shape_cast_3d.cpp:170 — plain INT, no PROPERTY_HINT_RANGE, so no bound
  max_results: v.int('max_results'),
  // scene/3d/physics/shape_cast_3d.cpp:171 — PROPERTY_HINT_LAYERS_3D_PHYSICS
  collision_mask: layerBitmask('collision_mask'),
  // scene/3d/physics/shape_cast_3d.cpp:175 (ADD_GROUP "Collide With")
  collide_with_areas: v.boolean('collide_with_areas'),
  // scene/3d/physics/shape_cast_3d.cpp:176 (ADD_GROUP "Collide With")
  collide_with_bodies: v.boolean('collide_with_bodies'),
  // scene/3d/physics/shape_cast_3d.cpp:179 (ADD_GROUP "Debug Shape") — no Shape2D counterpart
  debug_shape_custom_color: v.color('debug_shape_custom_color'),
});
