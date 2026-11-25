import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatLight2DProperties } from '../lights/shared/propertyFormatter';

export async function formatDirectionalLight2DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(['height', 'max_distance']);
  return formatLight2DProperties(node, [
    { label: 'Height', value: values.number('height').toFixed(2) },
    { label: 'Max Distance', value: `${values.number('max_distance').toFixed(0)} px` },
  ]);
}
