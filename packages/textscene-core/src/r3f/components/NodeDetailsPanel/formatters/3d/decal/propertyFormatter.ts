import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';
import { resourceText, rgbaText, tupleText } from '../../valueText';

const DECAL_PROPERTIES = [
  'texture_albedo',
  'texture_normal',
  'texture_orm',
  'texture_emission',
  'size',
  'modulate',
  'albedo_mix',
  'normal_fade',
  'upper_fade',
  'lower_fade',
  'cull_mask',
  'distance_fade_enabled',
  'distance_fade_begin',
  'distance_fade_length',
] as const;

/** The other maps show only where the decal holds one. */
const OPTIONAL_TEXTURES = [
  ['Normal', 'texture_normal'],
  ['ORM', 'texture_orm'],
  ['Emission', 'texture_emission'],
] as const;

export async function formatDecalProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(DECAL_PROPERTIES);
  const textureItems = [{ label: 'Albedo', value: resourceText(values.resource('texture_albedo')) }];
  for (const [label, property] of OPTIONAL_TEXTURES) {
    const texture = values.resource(property);
    if (texture !== null) textureItems.push({ label, value: texture });
  }
  return [
    { title: 'Textures', items: textureItems },
    {
      title: 'Projection',
      items: [
        { label: 'Size', value: tupleText(values.numbers('size')) },
        { label: 'Modulate', value: rgbaText(values.numbers('modulate')) },
        { label: 'Albedo Mix', value: values.number('albedo_mix').toFixed(2) },
        { label: 'Normal Fade', value: values.number('normal_fade').toFixed(2) },
        { label: 'Upper Fade', value: values.number('upper_fade').toFixed(2) },
        { label: 'Lower Fade', value: values.number('lower_fade').toFixed(2) },
        { label: 'Cull Mask', value: `0x${values.number('cull_mask').toString(16)}` },
      ],
    },
    {
      title: 'Distance Fade',
      items: [
        { label: 'Enabled', value: String(values.boolean('distance_fade_enabled')) },
        { label: 'Begin', value: values.number('distance_fade_begin').toFixed(2) },
        { label: 'Length', value: values.number('distance_fade_length').toFixed(2) },
      ],
    },
    ...(await formatNode3DProperties(node)),
  ];
}
