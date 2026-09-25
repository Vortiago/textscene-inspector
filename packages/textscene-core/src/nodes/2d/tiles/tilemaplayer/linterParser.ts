/** TileMapLayer strict validators for linting. */

import '../../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { propertyError, shape, v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { badIntElement } from '../../../../linter/validators/v/packedArrays.js';
import { markIntSlot } from '../../../../linter/validators/intSlot.js';
import { readTileMapDataLiteral } from '../shared/tileData.js';

/**
 * DebugVisibilityMode (tile_map_layer.h:341-345), three constants matching the
 * "Default,Force Show,Force Hide" hint on both visibility-mode properties. It has
 * the shape of TileMap's VisibilityMode under a different enum name.
 */
const DEBUG_VISIBILITY_MODE = { 0: 'DEFAULT', 1: 'FORCE_SHOW', 2: 'FORCE_HIDE' };

/**
 * `tile_map_data`, a stored PACKED_BYTE_ARRAY (tile_map_layer.cpp:2267). The writer switches the
 * whole file to base64 once any PackedByteArray passes 64 bytes (resource_format_text.cpp:1724-1728):
 * a 2-byte header and 12 bytes per cell make six cells base64 and five decimal. The reader accepts
 * both spellings whatever `format=` says (`variant_parser.cpp:1410-1427`).
 */
const tileMapDataValidator: PropertyValidator = shape((key, value, line) => {
  // Shape only: the `tilemaplayer-invalid-tile-data` rule decodes the header and the
  // cell records, and a second check here would fire twice on one malformed value.
  // A padded `PackedByteArray ( … )` loads: the tokenizer discards any character <= 32
  // before a token (variant_parser.cpp:415-417).
  const literal = readTileMapDataLiteral(value);
  if (literal.fault === 'not-a-literal') {
    return propertyError(
      key,
      line,
      `Property 'tile_map_data' must be a PackedByteArray like PackedByteArray(0, 0, 0) or a base64-quoted PackedByteArray("…"), got: "${value}"`,
      'INVALID_TILE_MAP_DATA_FORMAT'
    );
  }
  const { body } = literal;
  if (literal.fault === 'invalid-base64') {
    return propertyError(
      key,
      line,
      `Property 'tile_map_data' contains a malformed base64 string: ${body}`,
      'INVALID_TILE_MAP_DATA_FORMAT'
    );
  }
  if (body === '') return null;
  if (body.startsWith('"')) return null;
  // `uint8`, alone among the packed-int slots: `_parse_byte_array` (variant_parser.cpp:600)
  // pushes into a `Vector<uint8_t>` (:650) through `Variant::operator uint8_t()`
  // (variant.cpp:1519-1521). Measured on 4.6.3, `PackedByteArray(0, 0, 300, 0)` stores [0, 0, 44, 0].
  const bad = badIntElement(
    'tile_map_data',
    key,
    line,
    body,
    { format: 'INVALID_TILE_MAP_DATA_FORMAT', value: 'INVALID_TILE_MAP_DATA_VALUE' },
    'uint8'
  );
  return bad.error ?? bad.truncated;
}, 'PackedByteArray(…) int array of bytes, or a base64-quoted PackedByteArray("…") (decoded by the tilemaplayer-invalid-tile-data rule)');

// The tag the sweep reads: this is an INT slot, and an element it cannot hold
// is a refusal of a real value rather than a format complaint. `uint8` is the
// element's own width, so the sweep probes a byte's bounds rather than int32's.
markIntSlot(tileMapDataValidator, 'uint8');

validatorRegistry.registerAll('TileMapLayer', {
  tile_set: v.resourceReference('tile_set'),
  enabled: v.boolean('enabled'),
  // tile_map_layer.cpp:2267: see tileMapDataValidator.
  tile_map_data: tileMapDataValidator,

  // -- Rendering (tile_map_layer.cpp:2271-2275) --
  // set_occlusion_enabled (:3442-3450), bare assignment.
  occlusion_enabled: v.boolean('occlusion_enabled'),
  // set_y_sort_origin (:3321-3329), bare assignment. PROPERTY_HINT_NONE with
  // no suffix at all here, unlike TileMap's layer_#/y_sort_origin leaf which
  // carries "suffix:px" (tile_map.cpp:1034).
  y_sort_origin: v.strictInt('y_sort_origin'),
  // set_x_draw_order_reversed (:3335-3343), bare assignment.
  x_draw_order_reversed: v.boolean('x_draw_order_reversed'),
  // set_rendering_quadrant_size (:3369-3378): ERR_FAIL_COND_MSG(p_size < 1) floors it.
  // No range hint (PROPERTY_HINT_NONE at tile_map_layer.cpp:2275), unlike TileMap's own
  // property, which adds a hinted 128 ceiling (tilemap/linterParser.ts).
  rendering_quadrant_size: v.strictInt('rendering_quadrant_size', {
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
  collision_visibility_mode: v.enumInt('collision_visibility_mode', 0, 2, DEBUG_VISIBILITY_MODE, {
    hinted: 'tile_map_layer.cpp:2279',
  }),
  // set_physics_quadrant_size (:3426-3436): ERR_FAIL_COND_MSG(p_size < 1)
  // floors it. No range hint (hint == PROPERTY_HINT_NONE at :2280).
  physics_quadrant_size: v.strictInt('physics_quadrant_size', {
    min: 1,
    enforced: 'tile_map_layer.cpp:3430',
  }),

  // -- Navigation (tile_map_layer.cpp:2281-2284) --
  // set_navigation_enabled (:3457-3465), bare assignment. PROPERTY_HINT_GROUP_ENABLE only
  // makes the inspector group checkable and adds no value constraint.
  navigation_enabled: v.boolean('navigation_enabled'),
  // set_navigation_visibility_mode (:3490-3498), bare assignment. Hint at
  // ADD_PROPERTY tile_map_layer.cpp:2284.
  navigation_visibility_mode: v.enumInt('navigation_visibility_mode', 0, 2, DEBUG_VISIBILITY_MODE, {
    hinted: 'tile_map_layer.cpp:2284',
  }),
});
