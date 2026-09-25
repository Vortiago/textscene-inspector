/**
 * TileSet property validation. TileSet hand-builds `_get_property_list`
 * (tile_set.cpp:4143-4232) and `_set` (:3665-4008), so `ADD_PROPERTY` covers only
 * the five scalars here. Every other key belongs to one of six indexed families
 * in sibling modules.
 */

// Registers Resource, so the inherited keys resolve when this module loads alone.
import '../resource/linterValidators.js';
import { validatorRegistry } from '../../linter/ValidatorRegistry.js';
import { v } from '../../linter/validators/index.js';
import { layerFamilyKeys } from './layerValidators.js';
import { terrainSetValidator } from './terrainValidators.js';
import { patternValidator, sourceValidator, tileProxyValidator } from './sourceValidators.js';

/** tile_set.h:244-249. */
const TILE_SHAPE = {
  0: 'TILE_SHAPE_SQUARE',
  1: 'TILE_SHAPE_ISOMETRIC',
  2: 'TILE_SHAPE_HALF_OFFSET_SQUARE',
  3: 'TILE_SHAPE_HEXAGON',
};

/** tile_set.h:251-258. */
const TILE_LAYOUT = {
  0: 'TILE_LAYOUT_STACKED',
  1: 'TILE_LAYOUT_STACKED_OFFSET',
  2: 'TILE_LAYOUT_STAIRS_RIGHT',
  3: 'TILE_LAYOUT_STAIRS_DOWN',
  4: 'TILE_LAYOUT_DIAMOND_RIGHT',
  5: 'TILE_LAYOUT_DIAMOND_DOWN',
};

/** tile_set.h:260-263. */
const TILE_OFFSET_AXIS = { 0: 'TILE_OFFSET_AXIS_HORIZONTAL', 1: 'TILE_OFFSET_AXIS_VERTICAL' };

validatorRegistry.registerAll('TileSet', {
  // tile_set.cpp:4266. set_tile_shape (:352) assigns and re-notifies; no guard.
  tile_shape: v.enumInt('tile_shape', 0, 3, TILE_SHAPE, { hinted: 'tile_set.cpp:4266' }),
  // tile_set.cpp:4267. set_tile_layout (:368) is an assignment and an
  // emit_changed. Read only for a half-offset shape, but the value is stored
  // whatever tile_shape says, so the shape is no bound on it.
  tile_layout: v.enumInt('tile_layout', 0, 5, TILE_LAYOUT, { hinted: 'tile_set.cpp:4267' }),
  // tile_set.cpp:4268. set_tile_offset_axis (:376) assigns straight through.
  tile_offset_axis: v.enumInt('tile_offset_axis', 0, 1, TILE_OFFSET_AXIS, {
    hinted: 'tile_set.cpp:4268',
  }),
  // tile_set.cpp:4269, VECTOR2I with no range hint. set_tile_size opens
  // `ERR_FAIL_COND(p_size.x < 1 || p_size.y < 1)` (:392), so a zero or negative
  // extent never reaches the field.
  tile_size: v.vector2i('tile_size', { min: 1, enforced: 'tile_set.cpp:392' }),
  // tile_set.cpp:4369. set_uv_clipping (:567) assigns past an equality early-out.
  uv_clipping: v.boolean('uv_clipping'),
},
// The five `ADD_ARRAY`s (:4370-4378) add no key: `add_property_array` sets no
// storage bit (class_db.cpp:1500), so a family's length is its indices, never a count.
layerFamilyKeys,
{
  // A glued index over a leaf that may nest one level further (`terrain_set_0/mode`
  // beside `terrain_set_0/terrain_1/name`): the `#/**` routing shape. The `mode`
  // branch of `_set` (:3897-3902) falls to `return false` (:4007), but the write
  // lands, so nothing is reported.
  'terrain_set_#/**': terrainSetValidator,
  // `sources/<id>` is a `/`-separated prefix whose index ends the key, so the
  // plain path wildcard routes it and the validator reads the index itself.
  'sources/*': sourceValidator,
  'tile_proxies/*': tileProxyValidator,
  // `pattern_<n>` has no leaf at all: the terminal-index routing shape.
  'pattern_#': patternValidator,
});
