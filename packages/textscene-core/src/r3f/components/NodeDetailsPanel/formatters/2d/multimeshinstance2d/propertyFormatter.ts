import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';
import { resourceText } from '../../valueText';

export async function formatMultiMeshInstance2DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(['multimesh', 'texture']);
  return [
    {
      title: 'MultiMesh',
      items: [
        { label: 'MultiMesh', value: resourceText(values.resource('multimesh')) },
        { label: 'Texture', value: resourceText(values.resource('texture')) },
      ],
    },
    ...(await formatNode2DProperties(node)),
  ];
}
