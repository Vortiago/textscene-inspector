/**
 * ShapeCast2D strict validators: only the members doc/classes/ShapeCast2D.xml lists without
 * `overrides=`. The NODE_BASE_TYPES base-walk delivers everything from Node2D up, and a
 * re-declared key shadows it.
 */

import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../linter/validators/index.js';

// No `collision_result`: scene/2d/physics/shape_cast_2d.cpp:475 binds it with an empty setter
// (`ADD_PROPERTY(..., "", "get_collision_result")`), so no file can set it. Its
// `PROPERTY_USAGE_NO_EDITOR` alone would not block serialisation.
validatorRegistry.registerAll('ShapeCast2D', {
  enabled: v.boolean('enabled'),
  // scene/2d/physics/shape_cast_2d.cpp:469: ADD_PROPERTY(..., "shape", PROPERTY_HINT_RESOURCE_TYPE, "Shape2D")
  shape: v.resourceReference('shape'),
  exclude_parent: v.boolean('exclude_parent'),
  // scene/2d/physics/shape_cast_2d.cpp:471: PROPERTY_HINT_NONE, "suffix:px" (no range, only a unit hint)
  target_position: v.vector2('target_position'),
  // scene/2d/physics/shape_cast_2d.cpp:472: PROPERTY_HINT_RANGE, "0,100,0.01,suffix:px"
  // (no or_greater, but the setter is a bare assignment, so out-of-range only warns).
  margin: v.float('margin', { min: 0, max: 100, hinted: 'shape_cast_2d.cpp:472' }),
  // scene/2d/physics/shape_cast_2d.cpp:473: plain INT, no PROPERTY_HINT_RANGE, so no bound
  max_results: v.int('max_results'),
  // scene/2d/physics/shape_cast_2d.cpp:474: PROPERTY_HINT_LAYERS_2D_PHYSICS
  collision_mask: layerBitmask('collision_mask', { hinted: 'shape_cast_2d.cpp:474', width: 'uint32' /* shape_cast_2d.h:91 */ }),
  collide_with_areas: v.boolean('collide_with_areas'),
  collide_with_bodies: v.boolean('collide_with_bodies'),
});
