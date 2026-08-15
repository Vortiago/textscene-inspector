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
import { firstNonNumericElement, firstUnrepresentableIntElement } from '../../../../linter/validators/v/packedArrays.js';

// `\s*` at both ends and before the paren: Godot's tokenizer discards any
// character <= 32 before a token (variant_parser.cpp:415-417), so a padded
// `PackedInt32Array ( … )` loads, the same reasoning godot/variantParser.ts
// states for the NodePath and resource-ref literals.
const TILE_DATA_RE = /^\s*PackedInt32Array\s*\(([\s\S]*)\)\s*$/;

/**
 * tile_map.h:56-59, VisibilityMode. BIND_ENUM_CONSTANT count is 3
 * (DEFAULT/FORCE_SHOW/FORCE_HIDE) — same shape as TileMapLayer's own
 * DebugVisibilityMode (tilemaplayer/linterParser.ts), under a different enum
 * name; the "Default,Force Show,Force Hide" hint string is identical.
 */
const VISIBILITY_MODE = { 0: 'DEFAULT', 1: 'FORCE_SHOW', 2: 'FORCE_HIDE' };

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
  // Reads, but no int32 holds it: narrowed at parse
  // (_parse_construct<int32_t>, variant_parser.cpp:1428-1430).
  const unfit = firstUnrepresentableIntElement(body);
  if (unfit !== null) {
    return propertyError(
      key,
      line,
      `Property 'tile_data' has an element no integer can hold: "${unfit}"`,
      'INVALID_TILE_DATA_VALUE',
      'error'
    );
  }
  const offender = firstNonNumericElement(body);
  if (offender !== null) {
    return propertyError(
      key,
      line,
      `Property 'tile_data' contains a non-numeric value: "${offender}"`,
      'INVALID_TILE_DATA_FORMAT'
    );
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
