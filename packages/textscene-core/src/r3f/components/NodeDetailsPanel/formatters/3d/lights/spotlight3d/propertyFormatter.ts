import type { InspectedNode, PropertySection } from '../../../inspectedNode';
import { formatNode3DProperties } from '../../../base/node3d/propertyFormatter';
import { formatBaseLightSection, formatBaseShadowSection } from '../shared/propertyFormatter';

export async function formatSpotLight3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(['spot_range', 'spot_angle']);
  return [
    await formatBaseLightSection(node, [
      { label: 'Range', value: values.number('spot_range').toFixed(2) },
      { label: 'Angle', value: `${values.number('spot_angle').toFixed(1)}°` },
    ]),
    await formatBaseShadowSection(node),
    ...(await formatNode3DProperties(node)),
  ];
}
