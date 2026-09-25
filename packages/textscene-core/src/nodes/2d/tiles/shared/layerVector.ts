/**
 * Rebuilds the layer vector a loaded TileMap holds from its `layer_N/…` keys.
 * The renderer and the linter share it, so both count the gap layers the
 * engine fills.
 */

import { indexedElements } from '../../../../godot/index.js';

/**
 * The leaves `register_property` declares (tile_map.cpp:1030-1039). Only these
 * build a layer: `is_property_valid` ends at `property_list.has(components[1])`
 * (property_list_helper.cpp:135).
 */
export const LAYER_LEAF_NAMES = [
  'name',
  'enabled',
  'modulate',
  'y_sort_enabled',
  'y_sort_origin',
  'z_index',
  'navigation_enabled',
  'tile_data',
] as const;

/**
 * The leaf half of one `layer_<i>/<leaf>` key. `tilemap/linterParser.ts` keys its
 * validators by it, so the two lists cannot drift. It lives here, not with the
 * validators, because `tilemap/parser.ts` reads this module outside the linter bundle.
 */
export type LayerLeaf = (typeof LAYER_LEAF_NAMES)[number];

const LAYER_LEAVES: ReadonlySet<string> = new Set(LAYER_LEAF_NAMES);

/**
 * How far the gap fill goes. Godot's limit is memory: one `layer_2000000000/…`
 * key would build two billion layers. 64 layers already spend the per-layer
 * draw-order budget in one z_index step (TILE_LAYER_STEP = Z_INDEX_STEP / 64), so
 * past it only the written layers are kept, in order.
 */
const LAYER_FILL_CEILING = 64;

/**
 * Every layer the loaded TileMap has, in index order, with the leaves the file
 * wrote. `is_property_valid` (tile_map.cpp:700) gates the index on
 * `String::is_valid_int()` (property_list_helper.cpp:126), so `layer_+1/…` is
 * layer 1 and a negative index builds nothing.
 */
export function tileMapLayerVector(
  properties: Readonly<Record<string, string>>
): Array<[number, ReadonlyMap<string, string>]> {
  const declared = indexedElements(properties, 'layer_', 'is_valid_int');
  const written = [...declared.entries()].filter(([, leaves]) =>
    [...leaves.keys()].some((leaf) => LAYER_LEAVES.has(leaf))
  );
  // `_set` grows the vector to the highest index written (tile_map.cpp:701-710),
  // so skipped indices exist at TileMapLayer's defaults. `TileMap::TileMap()`
  // pushes "Layer0" first (tile_map.cpp:1014-1021), but past the ceiling only the
  // written set is kept.
  const layerCount = written.reduce((count, [index]) => Math.max(count, index + 1), 1);
  if (layerCount > LAYER_FILL_CEILING) return written.sort(([a], [b]) => a - b);
  return Array.from({ length: layerCount }, (_, index) => [index, declared.get(index) ?? new Map()]);
}
