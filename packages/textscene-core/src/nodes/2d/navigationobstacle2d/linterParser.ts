/**
 * NavigationObstacle2D strict validators for linting.
 *
 * Declare only NavigationObstacle2D's OWN members — the ones doc/classes/NavigationObstacle2D.xml
 * lists without an `overrides=` attribute. Everything from Node2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

// Node2D transform/position/... validators are inherited via the
// nodeBaseTypes base-walk — only the type-specific surface is registered here.
validatorRegistry.registerAll('NavigationObstacle2D', {
  // navigation_obstacle_2d.cpp:247, ERR_FAIL_COND_MSG(p_radius < 0.0, ...) is an
  // enforced floor. The ADD_PROPERTY hint (:72, "0.0,500,0.01,suffix:px") also
  // states a 500 ceiling the setter never checks, so the ceiling is a warning.
  radius: v.float('radius', {
    min: 0,
    max: 500,
    enforced: { min: 'navigation_obstacle_2d.cpp:247' },
    hinted: { max: 'navigation_obstacle_2d.cpp:72' },
  }),
  // navigation_obstacle_2d.cpp:73, PACKED_VECTOR2_ARRAY with a plain
  // `const Vector<Vector2> &get_vertices() const` getter — serialises as
  // PackedVector2Array(...), not a TypedArray spelling. set_vertices (:216)
  // only recomputes clockwise/valid debug flags, no format or range guard.
  vertices: v.packedVector2Array('vertices'),
  // navigation_obstacle_2d.cpp:75, plain BOOL, set_affect_navigation_mesh
  // (:312) assigns straight through.
  affect_navigation_mesh: v.boolean('affect_navigation_mesh'),
  // navigation_obstacle_2d.cpp:76, plain BOOL, set_carve_navigation_mesh
  // (:320) assigns straight through.
  carve_navigation_mesh: v.boolean('carve_navigation_mesh'),
  // navigation_obstacle_2d.cpp:78, PROPERTY_HINT_GROUP_ENABLE is an inspector
  // grouping widget, not a range hint; set_avoidance_enabled (:291) assigns
  // straight through.
  avoidance_enabled: v.boolean('avoidance_enabled'),
  // navigation_obstacle_2d.cpp:79, PROPERTY_USAGE_NO_EDITOR is ALSO
  // PROPERTY_USAGE_STORAGE (object.h:132): it hides from the inspector but
  // still serialises. set_velocity (:307) assigns straight through, no bound.
  velocity: v.vector2('velocity'),
  // navigation_obstacle_2d.cpp:80, PROPERTY_HINT_LAYERS_AVOIDANCE. Bare
  // uint32_t assignment in set_avoidance_layers (:261): the parameter type is
  // the ceiling, not a setter guard.
  avoidance_layers: layerBitmask('avoidance_layers', { hinted: 'navigation_obstacle_2d.cpp:80' }),
});
