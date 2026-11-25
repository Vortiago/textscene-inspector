import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';
import { resourceText, tupleText } from '../../valueText';

export async function formatPolygon2DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(['polygon', 'color', 'offset', 'texture']);
  return [
    {
      title: 'Polygon',
      items: [
        { label: 'Vertices', value: String(Math.floor(values.numbers('polygon').length / 2)) },
        { label: 'Color', value: tupleText(values.numbers('color')) },
        { label: 'Offset', value: tupleText(values.numbers('offset')) },
        { label: 'Texture', value: resourceText(values.resource('texture')) },
      ],
    },
    ...(await formatNode2DProperties(node)),
  ];
}
