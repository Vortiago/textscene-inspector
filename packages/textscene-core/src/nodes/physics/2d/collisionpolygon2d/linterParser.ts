/**
 * CollisionPolygon2D strict validators for linting.
 *
 * Declare only CollisionPolygon2D's OWN members — the ones doc/classes/CollisionPolygon2D.xml
 * lists without an `overrides=` attribute. Everything from Node2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('CollisionPolygon2D', {
  // collision_polygon_2d.cpp:308, PROPERTY_HINT_ENUM "Solids,Segments".
  // set_build_mode (:203-212) opens with `ERR_FAIL_INDEX((int)p_mode, 2)`
  // (:204), which refuses the assignment outright — enforced both ends.
  build_mode: v.enumInt(
    'build_mode',
    0,
    1,
    { 0: 'BUILD_SOLIDS', 1: 'BUILD_SEGMENTS' },
    { enforced: 'collision_polygon_2d.cpp:204' }
  ),
  // collision_polygon_2d.cpp:309 — PropertyInfo(Variant::PACKED_VECTOR2_ARRAY,
  // "polygon"); get_polygon (:199-201) returns the real Vector<Point2> field
  // (not a TypedArray behind the packed hint), so it serialises exactly as
  // PackedVector2Array(...) — confirmed against corpus scenes (e.g.
  // finite_state_machine/player/Player.tscn). set_polygon (:172-197) assigns
  // unconditionally, so this is a format check only.
  polygon: v.packedVector2Array('polygon'),
  // collision_polygon_2d.cpp:310 — plain BOOL, no hint. set_disabled
  // (:259-265) assigns unconditionally.
  disabled: v.boolean('disabled'),
  // collision_polygon_2d.cpp:313 — BOOL with PROPERTY_HINT_GROUP_ENABLE (a
  // group-header toggle, not a range hint). set_one_way_collision (:271-278)
  // assigns unconditionally.
  one_way_collision: v.boolean('one_way_collision'),
  // collision_polygon_2d.cpp:314, PROPERTY_HINT_RANGE "0,128,0.1,suffix:px".
  // set_one_way_collision_margin (:284-289) is a bare assignment, so
  // out-of-range warns rather than errors.
  one_way_collision_margin: v.float('one_way_collision_margin', {
    min: 0,
    max: 128,
    message: "Property 'one_way_collision_margin' must be non-negative (>= 0)",
    hinted: 'collision_polygon_2d.cpp:314',
  }),
});
