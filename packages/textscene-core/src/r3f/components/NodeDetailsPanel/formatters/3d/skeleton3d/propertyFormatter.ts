import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';

export async function formatSkeleton3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const bones = await node.call('get_bone_count');
  const values = await node.read(['show_rest_only']);
  return [
    {
      title: 'Skeleton3D',
      items: [
        { label: 'Bones', value: String(bones) },
        { label: 'Show Rest Only', value: String(values.boolean('show_rest_only')) },
      ],
    },
    ...(await formatNode3DProperties(node)),
  ];
}
