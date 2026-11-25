import type { InspectedNode, PropertySection } from '../../../inspectedNode';
import { formatNode3DProperties } from '../../../base/node3d/propertyFormatter';
import { DIRECTIONAL_SHADOW_MODE_NAMES } from '../../../../../../../godot/rendering/lights/directionalShadow';
import { formatBaseLightSection, formatShadowSectionWithNormalBias } from '../shared/propertyFormatter';
import { setRows } from '../../../setRows';

export async function formatDirectionalLight3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const shadowItems = await setRows(node, [
    {
      property: 'directional_shadow_mode',
      label: 'Shadow Mode',
      text: (mode) => DIRECTIONAL_SHADOW_MODE_NAMES[mode] ?? `Unknown (${mode})`,
    },
    { property: 'directional_shadow_max_distance', label: 'Max Distance', text: (value) => value.toFixed(2) },
  ]);
  return [
    await formatBaseLightSection(node),
    await formatShadowSectionWithNormalBias(node, shadowItems),
    ...(await formatNode3DProperties(node)),
  ];
}
