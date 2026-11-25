import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';
import { resourceText } from '../../valueText';

export async function formatMeshInstance2DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(['mesh', 'texture']);
  return [
    {
      title: 'Mesh',
      items: [
        { label: 'Mesh', value: resourceText(values.resource('mesh')) },
        { label: 'Texture', value: resourceText(values.resource('texture')) },
      ],
    },
    ...(await formatNode2DProperties(node)),
  ];
}
