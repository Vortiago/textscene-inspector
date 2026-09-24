/**
 * CollisionPolygon2D strict validators: only the members doc/classes/CollisionPolygon2D.xml lists
 * without `overrides=`. The NODE_BASE_TYPES base-walk delivers everything from Node2D up, and a
 * re-declared key shadows it.
 */

import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('CollisionPolygon2D', {
  // collision_polygon_2d.cpp:308, PROPERTY_HINT_ENUM "Solids,Segments".
  // set_build_mode (:203-212) opens with `ERR_FAIL_INDEX((int)p_mode, 2)`
  // (:204), which refuses the assignment outright: enforced both ends.
  build_mode: v.enumInt(
    'build_mode',
    0,
    1,
    { 0: 'BUILD_SOLIDS', 1: 'BUILD_SEGMENTS' },
    { enforced: 'collision_polygon_2d.cpp:204' }
  ),
  // collision_polygon_2d.cpp:309: PropertyInfo(Variant::PACKED_VECTOR2_ARRAY, "polygon").
  // get_polygon (:199-201) returns the Vector<Point2> field, not a TypedArray, so it
  // serialises as PackedVector2Array(...). set_polygon (:172-197) assigns unconditionally,
  // so this is a format check only.
  polygon: v.packedVector2Array('polygon'),
  // collision_polygon_2d.cpp:310: plain BOOL, no hint. set_disabled
  // (:259-265) assigns unconditionally.
  disabled: v.boolean('disabled'),
  // collision_polygon_2d.cpp:313: BOOL with PROPERTY_HINT_GROUP_ENABLE (a
  // group-header toggle, not a range hint). set_one_way_collision (:271-278)
  // assigns unconditionally.
  one_way_collision: v.boolean('one_way_collision'),
  // collision_polygon_2d.cpp:314, PROPERTY_HINT_RANGE "0,128,0.1,suffix:px".
  // set_one_way_collision_margin (:284-289) is a bare assignment, so out-of-range warns.
  // No `message` override: one message answers for both ends, and "must be non-negative"
  // is wrong for a value above 128.
  one_way_collision_margin: v.float('one_way_collision_margin', {
    min: 0,
    max: 128,
    hinted: 'collision_polygon_2d.cpp:314',
  }),
});
