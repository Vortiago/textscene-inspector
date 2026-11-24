/**
 * Parses a TileMap: the Node2D base plus the `layer_N/...` groups, rebuilt into
 * the layer vector Godot loads (`tileMapLayerVector`). Each `tile_data` decodes
 * under `format`, and only format 2 (TILE_MAP_DATA_FORMAT_3) renders.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseNode2D } from '../../../base/node2d/parser';
import { boolOr, intOr } from '../../../../parser/valueParsers';
import { tileMapLayerVector } from '../shared/layerVector';
import { parseColor } from '../../../../utils/colorParser';
import { decodeLegacyTileData } from '../shared/tileData';
import { DEFAULT_RENDERING_QUADRANT_SIZE, renderingQuadrantSizeOr } from '../shared/renderingQuadrantSize';
import type { TileMapLayerData, TileMapProperties } from './types';
import { tileMapLayerNames } from './layerNames';

export function parseTileMap(heading: ParsedHeading, properties: Record<string, string>): TileMapProperties {
  const baseProperties = parseNode2D(heading, properties);
  // Absent means the current format, not the oldest: the member initialises to
  // TILE_MAP_DATA_FORMAT_3, which is 2 (tile_map.h:64).
  const format = intOr(properties.format, 2);

  const names = tileMapLayerNames(properties);
  const layers = tileMapLayerVector(properties).map(([index, leaves]) =>
    parseLayer(names.get(index)!, leaves, format)
  );

  const result: TileMapProperties = {
    ...baseProperties,
    rendering_quadrant_size: tileMapRenderingQuadrantSize(properties),
    layers,
  };
  if (properties.tile_set) result.tile_set = properties.tile_set;
  return result;
}

/**
 * `_set` routes the deprecated `cell_quadrant_size` to the same setter (`tile_map.cpp:695-697`), so
 * the two keys apply in file order and the later one the setter accepts wins.
 */
function tileMapRenderingQuadrantSize(properties: Record<string, string>): number {
  const keys = Object.keys(properties);
  const isDeprecatedFirst = keys.indexOf('cell_quadrant_size') < keys.indexOf('rendering_quadrant_size');
  const writes = isDeprecatedFirst
    ? [properties.cell_quadrant_size, properties.rendering_quadrant_size]
    : [properties.rendering_quadrant_size, properties.cell_quadrant_size];
  return writes.reduce(
    (size: number, value) => renderingQuadrantSizeOr(value, size),
    DEFAULT_RENDERING_QUADRANT_SIZE
  );
}

function parseLayer(name: string, props: ReadonlyMap<string, string>, format: number): TileMapLayerData {
  const tileData = props.get('tile_data');
  const modulate = props.get('modulate');
  const layer: TileMapLayerData = {
    name,
    enabled: boolOr(props.get('enabled'), true),
    zIndex: intOr(props.get('z_index'), 0),
    ySortEnabled: boolOr(props.get('y_sort_enabled'), false),
    ySortOrigin: intOr(props.get('y_sort_origin'), 0),
    cells: tileData ? decodeLegacyTileData(tileData, format) : [],
  };
  if (modulate) layer.modulate = parseColor(modulate);
  return layer;
}
