/** TileMapLayer strict validators for linting. */

import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { TILE_MAP_VISIBILITY_MODE_NAMES } from '../../../../godot/scene/tileMap.js';

validatorRegistry.registerAll('TileMapLayer', {
  tile_set: v.resourceReference('tile_set'),
  enabled: v.boolean('enabled'),
  // tile_map_layer.cpp:2267. The tilemaplayer-invalid-tile-data rule decodes the cells.
  tile_map_data: v.packedByteArray('tile_map_data'),

  // -- Rendering (tile_map_layer.cpp:2271-2275) --
  // set_occlusion_enabled (:3442-3450), bare assignment.
  occlusion_enabled: v.boolean('occlusion_enabled'),
  // set_y_sort_origin (:3321-3329), bare assignment. PROPERTY_HINT_NONE with
  // no suffix at all here, unlike TileMap's layer_#/y_sort_origin leaf which
  // carries "suffix:px" (tile_map.cpp:1034).
  y_sort_origin: v.int('y_sort_origin'),
  // set_x_draw_order_reversed (:3335-3343), bare assignment.
  x_draw_order_reversed: v.boolean('x_draw_order_reversed'),
  // set_rendering_quadrant_size (:3369-3378): ERR_FAIL_COND_MSG(p_size < 1) floors it.
  // No range hint (PROPERTY_HINT_NONE at tile_map_layer.cpp:2275), unlike TileMap's own
  // property, which adds a hinted 128 ceiling (tilemap/linterParser.ts).
  rendering_quadrant_size: v.int('rendering_quadrant_size', {
    min: 1,
    enforced: 'tile_map_layer.cpp:3373',
  }),

  // -- Physics (tile_map_layer.cpp:2276-2280) --
  // set_collision_enabled (:3384-3392), bare assignment.
  collision_enabled: v.boolean('collision_enabled'),
  // set_use_kinematic_bodies (:3398-3406), bare assignment.
  use_kinematic_bodies: v.boolean('use_kinematic_bodies'),
  // set_collision_visibility_mode (:3412-3420), bare assignment. Hint at
  // ADD_PROPERTY tile_map_layer.cpp:2279.
  collision_visibility_mode: v.enumInt('collision_visibility_mode', TILE_MAP_VISIBILITY_MODE_NAMES, {
    hinted: 'tile_map_layer.cpp:2279',
  }),
  // set_physics_quadrant_size (:3426-3436): ERR_FAIL_COND_MSG(p_size < 1)
  // floors it. No range hint (hint == PROPERTY_HINT_NONE at :2280).
  physics_quadrant_size: v.int('physics_quadrant_size', {
    min: 1,
    enforced: 'tile_map_layer.cpp:3430',
  }),

  // -- Navigation (tile_map_layer.cpp:2281-2284) --
  // set_navigation_enabled (:3457-3465), bare assignment. PROPERTY_HINT_GROUP_ENABLE only
  // makes the inspector group checkable and adds no value constraint.
  navigation_enabled: v.boolean('navigation_enabled'),
  // set_navigation_visibility_mode (:3490-3498), bare assignment. Hint at
  // ADD_PROPERTY tile_map_layer.cpp:2284.
  navigation_visibility_mode: v.enumInt('navigation_visibility_mode', TILE_MAP_VISIBILITY_MODE_NAMES, {
    hinted: 'tile_map_layer.cpp:2284',
  }),
});
