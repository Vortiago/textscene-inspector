import type { InspectedNode, PropertySection } from '../../../inspectedNode';
import { formatNode3DProperties } from '../../../base/node3d/propertyFormatter';
import { realText } from '../../../valueText';
import { formatBaseLightSection, formatShadowSectionWithNormalBias } from '../shared/propertyFormatter';

export async function formatAreaLight3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const [width = 0, height = 0] = (await node.read(['area_size'])).numbers('area_size');
  return [
    await formatBaseLightSection(node, [
      { label: 'Size', value: `${realText(width)} × ${realText(height)}` },
    ]),
    // An area light draws no shadow here, and the section stays for parity with the other lights.
    await formatShadowSectionWithNormalBias(node),
    ...(await formatNode3DProperties(node)),
  ];
}
