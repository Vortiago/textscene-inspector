import type { InspectedNode, PropertySection } from '../../../inspectedNode';
import { formatNode3DProperties } from '../../../base/node3d/propertyFormatter';
import {
  formatBaseLightSection,
  formatShadowSectionWithNormalBias,
  setRows,
} from '../shared/propertyFormatter';

const SHADOW_MODES = ['ORTHOGONAL', 'PARALLEL_2_SPLITS', 'PARALLEL_4_SPLITS'];

export async function formatDirectionalLight3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const shadowItems = await setRows(node, [
    {
      property: 'directional_shadow_mode',
      label: 'Shadow Mode',
      text: (mode) => SHADOW_MODES[mode] ?? `Unknown (${mode})`,
    },
    { property: 'directional_shadow_max_distance', label: 'Max Distance', text: (value) => value.toFixed(2) },
  ]);
  return [
    await formatBaseLightSection(node),
    await formatShadowSectionWithNormalBias(node, shadowItems),
    ...(await formatNode3DProperties(node)),
  ];
}
