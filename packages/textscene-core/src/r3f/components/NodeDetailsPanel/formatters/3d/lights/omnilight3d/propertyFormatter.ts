import { OMNI_LIGHT_3D_SHADOW_MODE_NAMES } from '../../../../../../../godot/scene/light';
import type { InspectedNode, PropertySection } from '../../../inspectedNode';
import { formatNode3DProperties } from '../../../base/node3d/propertyFormatter';
import { formatBaseLightSection, formatShadowSectionWithNormalBias } from '../shared/propertyFormatter';
import { setRows } from '../../../setRows';

export async function formatOmniLight3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(['omni_range', 'omni_attenuation']);
  const shadowItems = await setRows(node, [
    {
      property: 'omni_shadow_mode',
      label: 'Shadow Mode',
      text: (mode) => OMNI_LIGHT_3D_SHADOW_MODE_NAMES[mode] ?? `Unknown (${mode})`,
    },
  ]);
  return [
    await formatBaseLightSection(node, [
      { label: 'Range', value: values.number('omni_range').toFixed(2) },
      { label: 'Attenuation', value: values.number('omni_attenuation').toFixed(2) },
    ]),
    await formatShadowSectionWithNormalBias(node, shadowItems),
    ...(await formatNode3DProperties(node)),
  ];
}
