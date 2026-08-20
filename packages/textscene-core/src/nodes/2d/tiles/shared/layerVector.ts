/**
 * The layer VECTOR a loaded TileMap holds, rebuilt from its `layer_N/…` keys.
 *
 * Shared because the renderer and the linter both need the same list and two
 * derivations answered differently: the rule scraped the written keys alone and
 * went silent on a gap the engine fills.
 */

import { indexedElements } from '../../../../godot/index.js';

/**
 * The leaves `register_property` declares for the family
 * (tile_map.cpp:1030-1039). A layer exists only for these: `_set` reaches its
 * grow loop through `is_property_valid`, which ends at
 * `property_list.has(components[1])` (property_list_helper.cpp:135), so
 * `layer_9/anything_else` builds nothing.
 */
const LAYER_LEAVES = new Set([
  'name',
  'enabled',
  'modulate',
  'y_sort_enabled',
  'y_sort_origin',
  'z_index',
  'navigation_enabled',
  'tile_data',
]);

/**
 * How far the gap fill goes. The engine's own limit is memory, so a single
 * `layer_2000000000/tile_data` grows two billion layers there and would build as
 * many objects here. 64 layers already spend the whole per-layer draw-order
 * budget inside one z_index step (TILE_LAYER_STEP = Z_INDEX_STEP / 64), so
 * filling past that buys no separation; the layers the file writes are kept in
 * index order instead. A contiguous file is unaffected however long it is, since
 * every index between its layers is one it writes.
 */
const LAYER_FILL_CEILING = 64;

/**
 * Every layer the loaded TileMap has, in index order, each with the leaves the
 * file wrote for it.
 *
 * The index resolves through the `is_valid_int` gate: `TileMap::_set` routes the
 * key through `property_helper.is_property_valid` (tile_map.cpp:700), whose gate
 * is `String::is_valid_int()` (property_list_helper.cpp:126), so `layer_+1/…` is
 * layer 1 and a negative index builds nothing.
 *
 * The vector then reaches the highest index written: `_set` builds a layer at a
 * time until `index < layers.size()` (tile_map.cpp:701-710), so the indices a
 * file skips exist too, at TileMapLayer's own defaults. One layer is the floor —
 * `TileMap::TileMap()` pushes a "Layer0" before any property is applied
 * (tile_map.cpp:1014-1021). That governs the fill branch only: past the ceiling
 * the written set is kept, so a file whose lowest written index is beyond it has
 * no Layer0 in the list.
 */
export function tileMapLayerVector(
  properties: Readonly<Record<string, string>>
): Array<[number, Record<string, string>]> {
  const declared = indexedElements(properties, 'layer_', 'is_valid_int');
  const written = [...declared.entries()].filter(([, leaves]) =>
    Object.keys(leaves).some((leaf) => LAYER_LEAVES.has(leaf))
  );
  const layerCount = written.reduce((count, [index]) => Math.max(count, index + 1), 1);
  if (layerCount > LAYER_FILL_CEILING) return written.sort(([a], [b]) => a - b);
  return Array.from({ length: layerCount }, (_, index) => [index, declared.get(index) ?? {}]);
}
