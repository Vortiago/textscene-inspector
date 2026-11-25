import type { InspectedNode, PropertySection } from '../../../inspectedNode';
import { formatNode2DProperties } from '../../../base/node2d/propertyFormatter';
import { resourceText } from '../../../valueText';
import { cellCountText, usedCellCount } from '../usedCells';

export async function formatTileMapProperties(node: InspectedNode): Promise<PropertySection[]> {
  const layerCount = Number(await node.call('get_layers_count'));
  const layers = [...Array(layerCount).keys()];
  const names = await node.read(['tile_set', ...layers.map((layer) => `layer_${layer}/name`)]);
  const counts = await Promise.all(
    layers.map(async (layer) => usedCellCount(await node.call('get_used_cells', layer)))
  );
  const items = [
    { label: 'Tile Set', value: resourceText(names.resource('tile_set')) },
    { label: 'Layers', value: layerCount.toString() },
    ...layers.map((layer) => ({
      label: names.string(`layer_${layer}/name`),
      value: cellCountText(counts[layer]!),
    })),
  ];
  return [{ title: 'Tile Map', items }, ...(await formatNode2DProperties(node))];
}
