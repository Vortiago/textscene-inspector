import { LIGHT_3D_BAKE_MODE_NAMES, LIGHT_3D_DEFAULTS } from '../../../../../../../godot/scene/light';
import type { InspectedNode, PropertyItem, PropertySection } from '../../../inspectedNode';
import { setRows, type SetRow } from '../../../setRows';
import { yesNo } from '../../../valueText';

const twoPlaces = (value: number) => value.toFixed(2);
const threePlaces = (value: number) => value.toFixed(3);

const LIGHT_SET_ROWS: readonly SetRow[] = [
  { property: 'light_negative', label: 'Negative', text: (value) => yesNo(value !== 0) },
  { property: 'light_specular', label: 'Specular', text: twoPlaces },
  { property: 'light_volumetric_fog_energy', label: 'Volumetric Fog Energy', text: twoPlaces },
];

const BIAS_ROW: SetRow = { property: 'shadow_bias', label: 'Bias', text: threePlaces };
const NORMAL_BIAS_ROW: SetRow = { property: 'shadow_normal_bias', label: 'Normal Bias', text: threePlaces };
const BLUR_ROW: SetRow = { property: 'shadow_blur', label: 'Blur', text: twoPlaces };

/** Colour and energy, the set rows, the bake mode off its default, then the class's own rows. */
export async function formatBaseLightSection(
  node: InspectedNode,
  ownItems: readonly PropertyItem[] = []
): Promise<PropertySection> {
  const values = await node.read(['light_color', 'light_energy', 'light_bake_mode']);
  const items = [
    { label: 'Color', value: values.text('light_color') },
    { label: 'Energy', value: values.number('light_energy').toFixed(2) },
    ...(await setRows(node, LIGHT_SET_ROWS)),
  ];
  const bakeMode = values.number('light_bake_mode');
  if (bakeMode !== LIGHT_3D_DEFAULTS.bakeMode) {
    items.push({ label: 'Bake Mode', value: LIGHT_3D_BAKE_MODE_NAMES[bakeMode] ?? `Unknown (${bakeMode})` });
  }
  return { title: 'Light', items: [...items, ...ownItems] };
}

/** Whether shadows are on and the bias and blur the file sets. SpotLight3D has no normal bias row. */
export async function formatBaseShadowSection(
  node: InspectedNode,
  ownItems: readonly PropertyItem[] = []
): Promise<PropertySection> {
  return shadowSection(node, [BIAS_ROW, BLUR_ROW], ownItems);
}

export async function formatShadowSectionWithNormalBias(
  node: InspectedNode,
  ownItems: readonly PropertyItem[] = []
): Promise<PropertySection> {
  return shadowSection(node, [BIAS_ROW, NORMAL_BIAS_ROW, BLUR_ROW], ownItems);
}

async function shadowSection(
  node: InspectedNode,
  rows: readonly SetRow[],
  ownItems: readonly PropertyItem[]
): Promise<PropertySection> {
  const values = await node.read(['shadow_enabled']);
  return {
    title: 'Shadows',
    items: [
      { label: 'Enabled', value: yesNo(values.boolean('shadow_enabled')) },
      ...(await setRows(node, rows)),
      ...ownItems,
    ],
  };
}
