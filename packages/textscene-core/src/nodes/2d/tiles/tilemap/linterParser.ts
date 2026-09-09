/**
 * TileMap strict validators for linting.
 *
 * `layer_<i>/*` is a `PropertyListHelper` family (tile_map.cpp:1023-1043),
 * glued-index like TabBar's `tab_<i>/*`: seven leaves
 * (name/enabled/modulate/y_sort_enabled/y_sort_origin/z_index/navigation_enabled)
 * plus `tile_data`. See propertyListRouteCoverage.test.ts.
 */

import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { CANVAS_ITEM_Z_MAX, CANVAS_ITEM_Z_MIN } from '../../../../godot/rendering.js';
import type { LayerLeaf } from '../shared/layerVector.js';
import { formatValidator, tileDataValidator } from './tileDataSlots.js';

/**
 * tile_map.h:56-59, VisibilityMode. BIND_ENUM_CONSTANT count is 3
 * (DEFAULT/FORCE_SHOW/FORCE_HIDE) — same shape as TileMapLayer's own
 * DebugVisibilityMode (tilemaplayer/linterParser.ts), under a different enum
 * name; the "Default,Force Show,Force Hide" hint string is identical.
 */
const VISIBILITY_MODE = { 0: 'DEFAULT', 1: 'FORCE_SHOW', 2: 'FORCE_HIDE' };

// Keyed by the shared name list, so a leaf declared in only one of the two
// places is a compile error rather than a silent divergence between which
// layers EXIST and which leaves are VALIDATED.
const LAYER_LEAVES: Readonly<Record<LayerLeaf, PropertyValidator>> = {
  // tile_map.cpp:1030, Variant::STRING. set_layer_name (:333-335) forwards
  // straight to Node::set_name, no format constraint of its own.
  name: v.quotedString('name'),
  // tile_map.cpp:1031, Variant::BOOL.
  enabled: v.boolean('enabled'),
  // tile_map.cpp:1032, Variant::COLOR.
  modulate: v.color('modulate'),
  // tile_map.cpp:1033, Variant::BOOL.
  y_sort_enabled: v.boolean('y_sort_enabled'),
  // tile_map.cpp:1034, Variant::INT, PROPERTY_HINT_NONE "suffix:px". A plain
  // display origin: TileMapLayer::set_y_sort_origin (tile_map_layer.cpp:3321)
  // is a bare assignment past an equality early-out.
  y_sort_origin: v.strictInt('y_sort_origin'),
  // tile_map.cpp:1035, Variant::INT. set_layer_z_index forwards through
  // TILEMAP_CALL_FOR_LAYER to TileMapLayer::set_z_index — CanvasItem's OWN
  // z_index setter, whose ERR_FAIL_COND against CANVAS_ITEM_Z_MIN/MAX
  // (canvas_item.cpp:668) is enforced, the same bound canvasitem/shared's own
  // z_index carries.
  z_index: v.strictInt('z_index', {
    min: CANVAS_ITEM_Z_MIN,
    max: CANVAS_ITEM_Z_MAX,
    enforced: 'canvas_item.cpp:668',
  }),
  // tile_map.cpp:1037, Variant::BOOL, #ifndef NAVIGATION_2D_DISABLED (on by default).
  navigation_enabled: v.boolean('navigation_enabled'),
  // tile_map.cpp:1039: see tileDataSlots.ts.
  tile_data: tileDataValidator,
};

const layerValidator = indexedFamilyValidator({
  prefix: 'layer_',
  leaves: LAYER_LEAVES,
  unknownCode: 'INVALID_TILEMAP_LAYER_KEY',
  describes: 'layer',
  // PropertyListHelper's own `_get_property` returns nullptr unless the index
  // `is_valid_int()` (property_list_helper.cpp:53-55), so a non-numeric index
  // is a DROPPED write, the same shape TabBar's tab_<i>/* family uses.
  indexParse: 'is_valid_int',
  negativeIndex: {
    cite: 'property_list_helper.cpp:58',
    code: 'INVALID_TILEMAP_LAYER_INDEX',
    message: (index) =>
      `Layer index ${index} must be non-negative. TileMap routes every layer_<idx>/<leaf> write through PropertyListHelper::_get_property, which returns nullptr for a negative index (property_list_helper.cpp:58), so the value is silently dropped`,
  },
});

validatorRegistry.registerAll('TileMap', {
  tile_set: v.resourceReference('tile_set'),
  // tile_map.cpp:747, PROPERTY_HINT_NONE with NO_EDITOR|INTERNAL usage — an
  // internal format-version tag Godot itself always writes, not a normal
  // ADD_PROPERTY. See tileDataSlots.ts.
  format: formatValidator,
  'layer_#/*': layerValidator,

  // tile_map.cpp:401-410, bare assignment (also toggles
  // notify_local_transform/physics_process_internal; no value constraint).
  collision_animatable: v.boolean('collision_animatable'),
  // tile_map.cpp:417-426, bare assignment, forwarded verbatim to every child
  // TileMapLayer::set_collision_visibility_mode. Hint at ADD_PROPERTY
  // tile_map.cpp:998.
  collision_visibility_mode: v.enumInt('collision_visibility_mode', 0, 2, VISIBILITY_MODE, {
    hinted: 'tile_map.cpp:998',
  }),
  // tile_map.cpp:433-442, bare assignment, forwarded to every child layer.
  // Hint at ADD_PROPERTY tile_map.cpp:1000.
  navigation_visibility_mode: v.enumInt('navigation_visibility_mode', 0, 2, VISIBILITY_MODE, {
    hinted: 'tile_map.cpp:1000',
  }),
  // tile_map.cpp:223-231: ERR_FAIL_COND_MSG(p_size < 1) floors it (also
  // forwarded to every child TileMapLayer::set_rendering_quadrant_size, which
  // re-enforces the same floor independently). The RANGE hint's 128 ceiling
  // (ADD_PROPERTY tile_map.cpp:996) is never checked by either setter, so it
  // warns rather than errors. TileMapLayer's OWN rendering_quadrant_size
  // carries no RANGE hint at all (tilemaplayer/linterParser.ts) — its ceiling
  // is fully open where TileMap's is a soft (warning-only) 128.
  rendering_quadrant_size: v.strictInt('rendering_quadrant_size', {
    min: 1,
    max: 128,
    enforced: { min: 'tile_map.cpp:224' },
    hinted: { max: 'tile_map.cpp:996' },
  }),
});
