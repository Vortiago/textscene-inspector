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
import { accepts, propertyError, v } from '../../../../linter/validators/index.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { CANVAS_ITEM_Z_MAX, CANVAS_ITEM_Z_MIN } from '../../../../godot/rendering.js';
import { IS_VALID_INT_RE } from '../../../../godot/index.js';

const TILE_DATA_RE = /^PackedInt32Array\(([\s\S]*)\)$/;

/**
 * `layer_<i>/tile_data`: registered `PropertyInfo(Variant::PACKED_INT32_ARRAY,
 * "tile_data", PROPERTY_HINT_NONE, "", PROPERTY_USAGE_NO_EDITOR)`
 * (tile_map.cpp:1039), storage-bearing. Shape-only: the format-AWARE decode
 * (triplet layout, which depends on the sibling `format` property this leaf
 * validator cannot see) is `tilemap-invalid-tile-data`'s job
 * (nodes/2d/tiles/tilemap/linter.ts), which already reuses
 * `decodeLegacyTileData`. Duplicating that check here would fire twice on one
 * malformed value.
 */
const tileDataValidator: PropertyValidator = accepts((key, value, line) => {
  const match = TILE_DATA_RE.exec(value.trim());
  if (!match) {
    return propertyError(
      key,
      line,
      `Property 'tile_data' must be a PackedInt32Array like PackedInt32Array(0, 0, 0), got: "${value}"`,
      'INVALID_TILE_DATA_FORMAT'
    );
  }
  const body = match[1]!.trim();
  if (body === '') return null;
  for (const part of body.split(',')) {
    if (!IS_VALID_INT_RE.test(part.trim())) {
      return propertyError(
        key,
        line,
        `Property 'tile_data' contains a non-integer value: "${part.trim()}"`,
        'INVALID_TILE_DATA_FORMAT'
      );
    }
  }
  return null;
}, 'PackedInt32Array(…) of cell triplets (decoded by the tilemap-invalid-tile-data rule)');
tileDataValidator.formatOnly = true;

const LAYER_LEAVES: Readonly<Record<string, PropertyValidator>> = {
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
  // tile_map.cpp:1039: see tileDataValidator.
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
  // ADD_PROPERTY. TileMap::_set (tile_map.cpp:687-691) casts the value
  // straight into the enum with zero validation (no ERR_FAIL, no clamp,
  // negative included), so no bound belongs here (ADR-0032 "none"); only the
  // integer format is checked.
  format: v.int('format'),
  'layer_#/*': layerValidator,
});
