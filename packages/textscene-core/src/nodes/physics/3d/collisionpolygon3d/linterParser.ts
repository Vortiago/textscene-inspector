/**
 * CollisionPolygon3D strict validators for linting.
 *
 * Declare only CollisionPolygon3D's OWN members — the ones doc/classes/CollisionPolygon3D.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * All six ADD_PROPERTY calls (collision_polygon_3d.cpp:279-288) bind a setter
 * that either bare-assigns or merely hints a range — nothing here has an
 * ERR_FAIL* or a clamp — so every bound below is `hinted` (warning) or absent
 * (format-only); none is `enforced`.
 */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { debugColorValidator } from '../../shared/debugColor.js';

validatorRegistry.registerAll('CollisionPolygon3D', {
  // collision_polygon_3d.cpp:279 — PROPERTY_HINT_NONE (the "suffix:m" is a
  // display suffix, not a range). set_depth (:139-143) assigns depth straight
  // through with no clamp or ERR_FAIL, so no bound exists to ground; format-only.
  depth: v.float('depth'),
  // collision_polygon_3d.cpp:280 — plain BOOL, no hint.
  disabled: v.boolean('disabled'),
  // collision_polygon_3d.cpp:281 — PACKED_VECTOR2_ARRAY. get_polygon (:131-133)
  // returns Vector<Point2> (Point2 = Vector2), matching the declared type, so
  // it serialises exactly as declared: PackedVector2Array(x, y, …), not
  // Array[Vector2](…). The polygon is 2D in the local XY plane; `depth` extrudes it.
  polygon: v.packedVector2Array('polygon'),
  // collision_polygon_3d.cpp:282 — PROPERTY_HINT_RANGE "0.001,10,0.001,suffix:m",
  // both ends closed (no or_greater/or_less). set_margin (:228-233) assigns
  // margin straight through with no clamp, so out-of-range is a warning, not
  // an error: the hint constrains the inspector widget only.
  margin: v.float('margin', { min: 0.001, max: 10, hinted: 'collision_polygon_3d.cpp:282' }),
  // collision_polygon_3d.cpp:284 — plain COLOR, no hint. set_debug_color
  // (:167-175) bare-assigns (with an unrelated no-op early-return when
  // unchanged); _get_default_debug_color (:162-165) is the same
  // SceneTree::get_debug_collisions_color() CollisionShape3D uses, so the
  // shared validator applies unchanged.
  debug_color: debugColorValidator,
  // collision_polygon_3d.cpp:288 — plain BOOL, no hint.
  debug_fill: v.boolean('debug_fill'),
});
