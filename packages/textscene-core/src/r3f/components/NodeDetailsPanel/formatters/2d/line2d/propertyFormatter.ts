import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';
import { tupleText } from '../../valueText';

export async function formatLine2DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(['points', 'width', 'default_color', 'closed']);
  return [
    {
      title: 'Line',
      items: [
        { label: 'Vertex Count', value: String(Math.floor(values.numbers('points').length / 2)) },
        { label: 'Width', value: String(values.number('width')) },
        { label: 'Color', value: tupleText(values.numbers('default_color')) },
        { label: 'Closed', value: String(values.boolean('closed')) },
      ],
    },
    ...(await formatNode2DProperties(node)),
  ];
}
