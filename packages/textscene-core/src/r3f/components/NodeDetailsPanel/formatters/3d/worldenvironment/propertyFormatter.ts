import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { resourceText } from '../../valueText';

export async function formatWorldEnvironmentProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(['environment', 'camera_attributes']);
  const items = [{ label: 'Environment', value: resourceText(values.resource('environment')) }];
  const cameraAttributes = values.resource('camera_attributes');
  if (cameraAttributes !== null) items.push({ label: 'Camera Attributes', value: cameraAttributes });
  return [{ title: 'Environment', items }];
}
