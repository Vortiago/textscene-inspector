import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatLight2DProperties } from '../lights/shared/propertyFormatter';

export async function formatPointLight2DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(['height', 'texture_scale']);
  return formatLight2DProperties(node, [
    { label: 'Height', value: `${values.number('height').toFixed(0)} px` },
    { label: 'Texture Scale', value: values.number('texture_scale').toFixed(2) },
  ]);
}
