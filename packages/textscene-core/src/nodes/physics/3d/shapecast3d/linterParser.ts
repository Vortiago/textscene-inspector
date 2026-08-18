/**
 * ShapeCast3D strict validators for linting.
 *
 * Declare only ShapeCast3D's OWN members — the ones doc/classes/ShapeCast3D.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `collision_result` is deliberately absent: scene/3d/physics/shape_cast_3d.cpp:172
 * binds it with an EMPTY setter (`ADD_PROPERTY(..., "", "get_collision_result")`) —
 * a getter-only Array holding the runtime-computed collision report, always `[]`
 * whenever the editor writes the file. `PROPERTY_USAGE_NO_EDITOR` only hides it
 * from the inspector (it does not itself block serialisation — see
 * `springbonecollision3d`'s `bone`, which carries the same flag and still gets a
 * validator); the missing setter is what makes this one impossible to author by
 * hand, so it gets no validator.
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
  // scene/3d/physics/shape_cast_3d.cpp:169 — PROPERTY_HINT_RANGE, "0,100,0.01,suffix:m"
  // (no or_greater, so 100 is a hard-looking cap, but the setter is a bare
  // assignment, so out-of-range only warns).
  margin: v.float('margin', { min: 0, max: 100, hinted: 'shape_cast_3d.cpp:169' }),
  // scene/3d/physics/shape_cast_3d.cpp:170 — plain INT, no PROPERTY_HINT_RANGE, so no bound
  max_results: v.int('max_results'),
  // scene/3d/physics/shape_cast_3d.cpp:171 — PROPERTY_HINT_LAYERS_3D_PHYSICS
  collision_mask: layerBitmask('collision_mask', { hinted: 'shape_cast_3d.cpp:171', width: 'uint32' /* shape_cast_3d.h:106 */ }),
  // scene/3d/physics/shape_cast_3d.cpp:175 (ADD_GROUP "Collide With")
  collide_with_areas: v.boolean('collide_with_areas'),
  // scene/3d/physics/shape_cast_3d.cpp:176 (ADD_GROUP "Collide With")
  collide_with_bodies: v.boolean('collide_with_bodies'),
  // scene/3d/physics/shape_cast_3d.cpp:179 (ADD_GROUP "Debug Shape") — no Shape2D counterpart
  debug_shape_custom_color: v.color('debug_shape_custom_color'),
});
