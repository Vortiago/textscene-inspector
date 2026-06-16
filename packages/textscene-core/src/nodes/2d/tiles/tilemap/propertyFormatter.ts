/** TileMap property formatter for the details panel. */

import type { PropertySection } from '../../../../core/NodeRegistry';
import { formatNode2DProperties } from '../../../base/node2d/propertyFormatter';
import type { TileMapProperties } from './types';

export function formatTileMapProperties(properties: TileMapProperties): PropertySection[] {
  const items: PropertySection['items'] = [
    { label: 'Tile Set', value: properties.tile_set ?? '(none)' },
    { label: 'Layers', value: properties.layers.length.toString() },
  ];
  for (const layer of properties.layers) {
    const count = layer.cells?.length ?? 0;
    items.push({
      label: layer.name,
      value: layer.cells === null ? 'invalid data' : `${count} cell${count === 1 ? '' : 's'}`,
    });
  }

  return [{ title: 'Tile Map', items }, ...formatNode2DProperties(properties)];
}
