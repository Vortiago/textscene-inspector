/**
 * TileMapLayer parser, which extends the Node2D base parse.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseNode2D } from '../../../base/node2d/parser';
import { boolOr } from '../../../../parser/valueParsers';
import { decodeTileMapData } from '../shared/tileData';
import { renderingQuadrantSizeOr } from '../shared/renderingQuadrantSize';
import type { TileMapLayerProperties } from './types';

export function parseTileMapLayer(
  heading: ParsedHeading,
  properties: Record<string, string>
): TileMapLayerProperties {
  const baseProperties = parseNode2D(heading, properties);
  const result: TileMapLayerProperties = {
    ...baseProperties,
    enabled: boolOr(properties.enabled, true),
    rendering_quadrant_size: renderingQuadrantSizeOr(properties.rendering_quadrant_size),
  };
  if (properties.tile_set) result.tile_set = properties.tile_set;
  if (properties.tile_map_data) result.cells = decodeTileMapData(properties.tile_map_data);
  return result;
}
