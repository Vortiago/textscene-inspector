import type { InspectedNode, PropertySection } from '../../../inspectedNode';
import { formatNode2DProperties } from '../../../base/node2d/propertyFormatter';

export async function formatArea2DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(['monitoring', 'monitorable', 'collision_layer', 'collision_mask']);
  return [
    {
      title: 'Area2D',
      items: [
        { label: 'Monitoring', value: String(values.boolean('monitoring')) },
        { label: 'Monitorable', value: String(values.boolean('monitorable')) },
        { label: 'Collision Layer', value: String(values.number('collision_layer')) },
        { label: 'Collision Mask', value: String(values.number('collision_mask')) },
      ],
    },
    ...(await formatNode2DProperties(node)),
  ];
}
