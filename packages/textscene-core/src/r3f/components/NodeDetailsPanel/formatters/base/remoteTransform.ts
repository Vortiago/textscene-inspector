import type { InspectedNode, PropertySection } from '../inspectedNode';

export async function remoteTransformSection(node: InspectedNode, title: string): Promise<PropertySection> {
  const values = await node.read([
    'remote_path',
    'update_position',
    'update_rotation',
    'update_scale',
    'use_global_coordinates',
  ]);
  const remotePath = values.string('remote_path');
  return {
    title,
    items: [
      { label: 'Remote Path', value: remotePath === '' ? '(none)' : remotePath },
      { label: 'Update Position', value: String(values.boolean('update_position')) },
      { label: 'Update Rotation', value: String(values.boolean('update_rotation')) },
      { label: 'Update Scale', value: String(values.boolean('update_scale')) },
      { label: 'Use Global Coordinates', value: String(values.boolean('use_global_coordinates')) },
    ],
  };
}
