import type { InspectedNode, PropertySection } from '../../../inspectedNode';
import { formatNode2DProperties } from '../../../base/node2d/propertyFormatter';
import { resourceText } from '../../../valueText';
import { usedCellCount } from '../usedCells';

export async function formatTileMapLayerProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(['tile_set', 'enabled']);
  const items = [
    { label: 'Tile Set', value: resourceText(values.resource('tile_set')) },
    { label: 'Cells', value: usedCellCount(await node.call('get_used_cells')).toString() },
  ];
  if (!values.boolean('enabled')) items.push({ label: 'Enabled', value: 'No' });
  return [{ title: 'Tile Map', items }, ...(await formatNode2DProperties(node))];
}
