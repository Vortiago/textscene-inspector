import { HORIZONTAL_ALIGNMENT_NAMES, VERTICAL_ALIGNMENT_NAMES } from '../../../../../../godot/math/alignment';
import { AUTOWRAP_MODE_NAMES } from '../../../../../../godot/text/textServerEnums';
import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';
import { billboardName } from '../../sprites/billboardName';
import { rgbaText } from '../../valueText';

const LABEL_3D_PROPERTIES = [
  'text',
  'pixel_size',
  'billboard',
  'shaded',
  'horizontal_alignment',
  'vertical_alignment',
  'width',
  'autowrap_mode',
  'autowrap_trim_flags',
  'justification_flags',
  'uppercase',
  'offset',
  'modulate',
  'outline_size',
  'outline_modulate',
] as const;

function onOff(isOn: boolean): string {
  return isOn ? 'On' : 'Off';
}

export async function formatLabel3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(LABEL_3D_PROPERTIES);
  const [offsetX = 0, offsetY = 0] = values.numbers('offset');
  const sections: PropertySection[] = [
    {
      title: 'Text',
      items: [
        { label: 'Text', value: values.string('text') || '(empty)' },
        { label: 'Pixel Size', value: values.number('pixel_size').toFixed(4) },
        { label: 'Billboard', value: billboardName(values.number('billboard')) },
        { label: 'Shaded', value: onOff(values.boolean('shaded')) },
      ],
    },
    {
      title: 'Layout',
      items: [
        {
          label: 'Horizontal Alignment',
          value: HORIZONTAL_ALIGNMENT_NAMES[values.number('horizontal_alignment')]!,
        },
        {
          label: 'Vertical Alignment',
          value: VERTICAL_ALIGNMENT_NAMES[values.number('vertical_alignment')]!,
        },
        { label: 'Width', value: String(values.number('width')) },
        { label: 'Autowrap Mode', value: AUTOWRAP_MODE_NAMES[values.number('autowrap_mode')]! },
        { label: 'Autowrap Trim Flags', value: String(values.number('autowrap_trim_flags')) },
        { label: 'Justification Flags', value: String(values.number('justification_flags')) },
        { label: 'Uppercase', value: onOff(values.boolean('uppercase')) },
        { label: 'Offset', value: `${offsetX}, ${offsetY}` },
      ],
    },
    { title: 'Color', items: [{ label: 'Modulate', value: rgbaText(values.numbers('modulate')) }] },
  ];
  const outlineSize = values.number('outline_size');
  if (outlineSize > 0) {
    sections.push({
      title: 'Outline',
      items: [
        { label: 'Outline Size', value: outlineSize.toFixed(0) },
        { label: 'Outline Color', value: rgbaText(values.numbers('outline_modulate')) },
      ],
    });
  }
  return [...sections, ...(await formatNode3DProperties(node))];
}
