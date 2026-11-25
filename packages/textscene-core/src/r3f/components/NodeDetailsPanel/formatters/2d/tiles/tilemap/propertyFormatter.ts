import type { InspectedNode, PropertySection } from '../../../inspectedNode';
import { formatNode2DProperties } from '../../../base/node2d/propertyFormatter';
import { resourceText } from '../../../valueText';
import { cellCountText, usedCellCount } from '../usedCells';

export async function formatTileMapProperties(node: InspectedNode): Promise<PropertySection[]> {
  const layerCount = Number(await node.call('get_layers_count'));
  const indices = [...Array(layerCount).keys()];
  const names = await node.read(['tile_set', ...indices.map((layer) => `layer_${layer}/name`)]);
  // A gap layer past the name ceiling has no name to read (`layerNames.ts`), and shows no row.
  const layers = indices.filter((layer) => names.has(`layer_${layer}/name`));
  const counts = await Promise.all(
    layers.map(async (layer) => usedCellCount(await node.call('get_used_cells', layer)))
  );
  const items = [
    { label: 'Tile Set', value: resourceText(names.resource('tile_set')) },
    { label: 'Layers', value: layerCount.toString() },
    ...layers.map((layer, index) => ({
      label: names.string(`layer_${layer}/name`),
      value: cellCountText(counts[index]!),
    })),
  ];
  return [{ title: 'Tile Map', items }, ...(await formatNode2DProperties(node))];
}
