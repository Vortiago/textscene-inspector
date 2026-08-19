/**
 * TileMap parser — the Node2D base plus the legacy multi-layer surface:
 * `layer_N/...` property groups rebuilt into the layer VECTOR Godot loads,
 * which reaches every index up to the highest one written and is never empty.
 * Past {@link LAYER_FILL_CEILING} only the written layers are kept, in index
 * order, and both of those claims narrow to the written set. Each layer's
 * `tile_data` is decoded through the shared legacy decoder (TSCN `format`
 * property selects the encoding; only format 2 = TILE_MAP_DATA_FORMAT_3
 * renders, see tileData.ts).
 */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseNode2D } from '../../../base/node2d/parser';
import { boolOr, intOr } from '../../../../parser/valueParsers';
import { indexedElements } from '../../../../godot/index.js';
import { parseColor } from '../../../../utils/colorParser';
import { decodeLegacyTileData } from '../shared/tileData';
import type { TileMapLayerData, TileMapProperties } from './types';

/**
 * The leaves `register_property` declares for the family
 * (tile_map.cpp:1030-1039). A layer exists only for these: `_set` reaches its
 * grow loop through `is_property_valid`, which ends at
 * `property_list.has(components[1])` (property_list_helper.cpp:135), so
 * `layer_9/anything_else` builds nothing. The five this parser reads are a
 * subset — the other three still seat a layer.
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
 * `layer_2000000000/tile_data` grows two billion layers there and would build
 * as many objects here. 64 layers already spend the whole per-layer draw-order
 * budget inside one z_index step (TILE_LAYER_STEP = Z_INDEX_STEP / 64), so
 * filling past that buys no separation; the layers the file writes are kept in
 * index order instead. A contiguous file is unaffected however long it is,
 * since every index between its layers is one it writes.
 */
const LAYER_FILL_CEILING = 64;

export function parseTileMap(
  heading: ParsedHeading,
  properties: Record<string, string>
): TileMapProperties {
  const baseProperties = parseNode2D(heading, properties);
  const format = intOr(properties.format, 0);

  // `TileMap::_set` routes the family through
  // `property_helper.is_property_valid` (tile_map.cpp:700), which gates the
  // index on `String::is_valid_int()` (property_list_helper.cpp:126) and so
  // reads a leading sign; `property_set_value` then drops a negative one at
  // `_get_property`'s `index < 0` (:58).
  const layerProps = indexedElements(properties, 'layer_', 'is_valid_int');

  // The vector reaches the highest index written: `_set` builds a layer at a
  // time until `index < layers.size()` (tile_map.cpp:701-710), so the indices
  // a file skips exist too, at TileMapLayer's own defaults.
  const written = [...layerProps.entries()].filter(([, leaves]) =>
    Object.keys(leaves).some((leaf) => LAYER_LEAVES.has(leaf))
  );
  // One layer is the floor: the constructor pushes a "Layer0" before any
  // property is applied (tile_map.cpp:1014-1021). It governs the fill branch
  // only — the fallback below keeps the written set, so a file whose lowest
  // written index is past the ceiling has no Layer0 in it. Nothing is drawn
  // either way: a layer no property named carries no `tile_data`.
  const layerCount = written.reduce((count, [index]) => Math.max(count, index + 1), 1);
  const layers =
    layerCount <= LAYER_FILL_CEILING
      ? Array.from({ length: layerCount }, (_, index) =>
          parseLayer(index, layerProps.get(index) ?? {}, format)
        )
      : written
          .sort(([a], [b]) => a - b)
          .map(([index, leaves]) => parseLayer(index, leaves, format));

  const result: TileMapProperties = { ...baseProperties, layers };
  if (properties.tile_set) result.tile_set = properties.tile_set;
  return result;
}

function parseLayer(
  index: number,
  props: Record<string, string>,
  format: number
): TileMapLayerData {
  // `layer_0/name = "Ground"` — the raw value keeps its quotes. An empty one
  // never lands: `set_name` opens with `ERR_FAIL_COND(p_name.is_empty())`
  // (node.cpp:1432), leaving the name `_set` gave the layer when it built it,
  // `vformat("Layer%d", index)` (tile_map.cpp:706).
  const rawName = props.name === undefined ? undefined : unquoteString(props.name);
  const layer: TileMapLayerData = {
    name: rawName || `Layer${index}`,
    enabled: boolOr(props.enabled, true),
    zIndex: intOr(props.z_index, 0),
    cells: props.tile_data ? decodeLegacyTileData(props.tile_data, format) : [],
  };
  if (props.modulate) layer.modulate = parseColor(props.modulate);
  return layer;
}
