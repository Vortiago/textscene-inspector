/** TileMapLayer property formatter for the details panel. */

import type { PropertySection } from '../../../../core/NodeRegistry';
import { formatNode2DProperties } from '../../../base/node2d/propertyFormatter';
import type { TileMapLayerProperties } from './types';

export function formatTileMapLayerProperties(
  properties: TileMapLayerProperties
): PropertySection[] {
  const items: PropertySection['items'] = [
    { label: 'Tile Set', value: properties.tile_set ?? '(none)' },
    { label: 'Cells', value: (properties.cells?.length ?? 0).toString() },
  ];
  if (!properties.enabled) items.push({ label: 'Enabled', value: 'No' });

  return [{ title: 'Tile Map', items }, ...formatNode2DProperties(properties)];
}
