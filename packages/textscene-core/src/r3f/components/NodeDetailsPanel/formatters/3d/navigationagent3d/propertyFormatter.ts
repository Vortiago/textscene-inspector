import type { InspectedNode, PropertySection } from '../../inspectedNode';

export async function formatNavigationAgent3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read([
    'radius',
    'height',
    'avoidance_enabled',
    'avoidance_layers',
    'avoidance_mask',
    'max_neighbors',
    'max_speed',
    'navigation_layers',
    'target_desired_distance',
    'path_desired_distance',
  ]);
  return [
    {
      title: 'NavigationAgent3D',
      items: [
        { label: 'Radius', value: values.number('radius').toFixed(2) },
        { label: 'Height', value: values.number('height').toFixed(2) },
        { label: 'Avoidance Enabled', value: String(values.boolean('avoidance_enabled')) },
        { label: 'Avoidance Layers', value: String(values.number('avoidance_layers')) },
        { label: 'Avoidance Mask', value: String(values.number('avoidance_mask')) },
        { label: 'Max Neighbors', value: String(values.number('max_neighbors')) },
        { label: 'Max Speed', value: values.number('max_speed').toFixed(2) },
        { label: 'Navigation Layers', value: String(values.number('navigation_layers')) },
        { label: 'Target Desired Distance', value: values.number('target_desired_distance').toFixed(2) },
        { label: 'Path Desired Distance', value: values.number('path_desired_distance').toFixed(2) },
      ],
    },
  ];
}
