import type { InspectedNode, PropertySection } from '../../../inspectedNode';
import { formatNode2DProperties } from '../../../base/node2d/propertyFormatter';
import { resourceText } from '../../../valueText';
import { cellCountText, usedCellCount } from '../usedCells';
import { visitIndexedKeys } from '../../../../../../../godot/classdb/indexedKey.js';

export async function formatTileMapProperties(node: InspectedNode): Promise<PropertySection[]> {
  const answer = await node.call('get_layers_count');
  // `get_layers_count` answers an int, so any other answer counts as no layer.
  const layerCount = typeof answer === 'number' ? answer : 0;
  const layers = shownLayers(node.fileProperties, layerCount);
  const names = await node.read(['tile_set', ...layers.map((layer) => `layer_${layer}/name`)]);
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

/** Layer 0, which every TileMap has, and each layer the file writes a property of. */
function shownLayers(fileProperties: ReadonlySet<string>, layerCount: number): number[] {
  const layers = new Set([0]);
  const named = Object.fromEntries([...fileProperties].map((property) => [property, '']));
  visitIndexedKeys(named, 'layer_', 'is_valid_int', (_key, _indexText, layer) => layers.add(layer));
  return [...layers].filter((layer) => layer < layerCount).sort((a, b) => a - b);
}
