import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';

export async function formatNavigationObstacle3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read([
    'radius',
    'height',
    'avoidance_enabled',
    'avoidance_layers',
    'affect_navigation_mesh',
    'carve_navigation_mesh',
    'use_3d_avoidance',
  ]);
  return [
    {
      title: 'NavigationObstacle3D',
      items: [
        { label: 'Radius', value: values.number('radius').toFixed(2) },
        { label: 'Height', value: values.number('height').toFixed(2) },
        { label: 'Avoidance Enabled', value: String(values.boolean('avoidance_enabled')) },
        { label: 'Avoidance Layers', value: String(values.number('avoidance_layers')) },
        { label: 'Affect Navigation Mesh', value: String(values.boolean('affect_navigation_mesh')) },
        { label: 'Carve Navigation Mesh', value: String(values.boolean('carve_navigation_mesh')) },
        { label: 'Use 3D Avoidance', value: String(values.boolean('use_3d_avoidance')) },
      ],
    },
    ...(await formatNode3DProperties(node)),
  ];
}
