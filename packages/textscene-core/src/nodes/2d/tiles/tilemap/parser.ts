/**
 * Parses a TileMap: the Node2D base plus the `layer_N/...` groups, rebuilt into
 * the layer vector Godot loads (`tileMapLayerVector`). Each `tile_data` decodes
 * under `format`, and only format 2 (TILE_MAP_DATA_FORMAT_3) renders.
 */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseNode2D } from '../../../base/node2d/parser';
import { boolOr, intOr } from '../../../../parser/valueParsers';
import { tileMapLayerVector } from '../shared/layerVector';
import { parseColor } from '../../../../utils/colorParser';
import { decodeLegacyTileData } from '../shared/tileData';
import type { TileMapLayerData, TileMapProperties } from './types';

export function parseTileMap(
  heading: ParsedHeading,
  properties: Record<string, string>
): TileMapProperties {
  const baseProperties = parseNode2D(heading, properties);
  // Absent means the current format, not the oldest: the member initialises to
  // TILE_MAP_DATA_FORMAT_3, which is 2 (tile_map.h:64).
  const format = intOr(properties.format, 2);

  const layers = tileMapLayerVector(properties).map(([index, leaves]) =>
    parseLayer(index, leaves, format)
  );

  const result: TileMapProperties = { ...baseProperties, layers };
  if (properties.tile_set) result.tile_set = properties.tile_set;
  return result;
}

function parseLayer(
  index: number,
  props: ReadonlyMap<string, string>,
  format: number
): TileMapLayerData {
  // `layer_0/name = "Ground"`: the raw value keeps its quotes. An empty one
  // never lands: `set_name` opens with `ERR_FAIL_COND(p_name.is_empty())`
  // (node.cpp:1432), leaving the name `_set` gave the layer when it built it,
  // `vformat("Layer%d", index)` (tile_map.cpp:706).
  const rawNameValue = props.get('name');
  const rawName = rawNameValue === undefined ? undefined : unquoteString(rawNameValue);
  const tileData = props.get('tile_data');
  const modulate = props.get('modulate');
  const layer: TileMapLayerData = {
    name: rawName || `Layer${index}`,
    enabled: boolOr(props.get('enabled'), true),
    zIndex: intOr(props.get('z_index'), 0),
    cells: tileData ? decodeLegacyTileData(tileData, format) : [],
  };
  if (modulate) layer.modulate = parseColor(modulate);
  return layer;
}
