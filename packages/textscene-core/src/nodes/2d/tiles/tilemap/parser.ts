/**
 * TileMap parser — the Node2D base plus the legacy multi-layer surface:
 * `layer_N/...` property groups collected in index order, each layer's
 * `tile_data` decoded through the shared legacy decoder (TSCN `format`
 * property selects the encoding; only format 2 = TILE_MAP_DATA_FORMAT_3
 * renders, see tileData.ts).
 */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseNode2D } from '../../../base/node2d/parser';
import { boolOr, intOr } from '../../../../parser/valueParsers';
import { parseColor } from '../../../../utils/colorParser';
import { decodeLegacyTileData } from '../shared/tileData';
import type { TileMapLayerData, TileMapProperties } from './types';

const LAYER_KEY_RE = /^layer_(\d+)\/(.+)$/;

export function parseTileMap(
  heading: ParsedHeading,
  properties: Record<string, string>
): TileMapProperties {
  const baseProperties = parseNode2D(heading, properties);
  const format = intOr(properties.format, 0);

  const layerProps = new Map<number, Record<string, string>>();
  for (const [key, value] of Object.entries(properties)) {
    const m = LAYER_KEY_RE.exec(key);
    if (!m) continue;
    const index = parseInt(m[1]!, 10);
    let layer = layerProps.get(index);
    if (!layer) {
      layer = {};
      layerProps.set(index, layer);
    }
    layer[m[2]!] = value;
  }

  const layers: TileMapLayerData[] = [...layerProps.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, props]): TileMapLayerData => {
      // `layer_0/name = "Ground"` — the raw value keeps its quotes.
      const rawName = props.name === undefined ? undefined : unquoteString(props.name);
      const layer: TileMapLayerData = {
        name: rawName || `Layer ${index}`,
        enabled: boolOr(props.enabled, true),
        zIndex: intOr(props.z_index, 0),
        cells: props.tile_data ? decodeLegacyTileData(props.tile_data, format) : [],
      };
      if (props.modulate) layer.modulate = parseColor(props.modulate);
      return layer;
    });

  const result: TileMapProperties = { ...baseProperties, layers };
  if (properties.tile_set) result.tile_set = properties.tile_set;
  return result;
}
