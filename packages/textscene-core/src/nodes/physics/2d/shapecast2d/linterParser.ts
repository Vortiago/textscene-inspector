/**
 * ShapeCast2D strict validators for linting.
 *
 * Declare only ShapeCast2D's OWN members — the ones doc/classes/ShapeCast2D.xml
 * lists without an `overrides=` attribute. Everything from Node2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `collision_result` is deliberately absent: scene/2d/physics/shape_cast_2d.cpp:475
 * binds it with an EMPTY setter (`ADD_PROPERTY(..., "", "get_collision_result")`) —
 * a getter-only Array holding the runtime-computed collision report, always `[]`
 * whenever the editor writes the file. `PROPERTY_USAGE_NO_EDITOR` only hides it
 * from the inspector (it does not itself block serialisation — see
 * `springbonecollision3d`'s `bone`, which carries the same flag and still gets a
 * validator); the missing setter is what makes this one impossible to author by
 * hand, so it gets no validator.
 */

import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('ShapeCast2D', {
  enabled: v.boolean('enabled'),
  // scene/2d/physics/shape_cast_2d.cpp:469 — ADD_PROPERTY(..., "shape", PROPERTY_HINT_RESOURCE_TYPE, "Shape2D")
  shape: v.resourceReference('shape'),
  exclude_parent: v.boolean('exclude_parent'),
  // scene/2d/physics/shape_cast_2d.cpp:471 — PROPERTY_HINT_NONE, "suffix:px" (no range, just a unit hint)
  target_position: v.vector2('target_position'),
  // scene/2d/physics/shape_cast_2d.cpp:472 — PROPERTY_HINT_RANGE, "0,100,0.01,suffix:px"
  // (no or_greater, so 100 is a hard-looking cap, but the setter is a bare
  // assignment, so out-of-range only warns).
  margin: v.float('margin', { min: 0, max: 100, hinted: 'shape_cast_2d.cpp:472' }),
  // scene/2d/physics/shape_cast_2d.cpp:473 — plain INT, no PROPERTY_HINT_RANGE, so no bound
  max_results: v.int('max_results'),
  // scene/2d/physics/shape_cast_2d.cpp:474 — PROPERTY_HINT_LAYERS_2D_PHYSICS
  collision_mask: layerBitmask('collision_mask', { hinted: 'shape_cast_2d.cpp:474' }),
  collide_with_areas: v.boolean('collide_with_areas'),
  collide_with_bodies: v.boolean('collide_with_bodies'),
});
