/** Label3D property formatter: the inspector sections for a label. */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { Label3DProperties } from './types';
import { formatColorRgba } from '../../../utils/colorParser';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';
import { billboardName } from '../sprites/shared/billboardName';
import { HORIZONTAL_ALIGNMENT_NAMES, VERTICAL_ALIGNMENT_NAMES } from '../../../godot/math/alignment';
import { AUTOWRAP_MODE_NAMES } from '../../../godot/text/textServerEnums';

export function formatLabel3DProperties(properties: Label3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  const textItems: PropertySection['items'] = [
    { label: 'Text', value: properties.text || '(empty)' },
    { label: 'Pixel Size', value: properties.pixel_size.toFixed(4) },
    { label: 'Billboard', value: billboardName(properties.billboard) },
    { label: 'Shaded', value: properties.shaded ? 'On' : 'Off' },
  ];

  sections.push({
    title: 'Text',
    items: textItems,
  });

  sections.push({
    title: 'Layout',
    items: [
      { label: 'Horizontal Alignment', value: HORIZONTAL_ALIGNMENT_NAMES[properties.horizontal_alignment]! },
      { label: 'Vertical Alignment', value: VERTICAL_ALIGNMENT_NAMES[properties.vertical_alignment]! },
      { label: 'Width', value: String(properties.width) },
      { label: 'Autowrap Mode', value: AUTOWRAP_MODE_NAMES[properties.autowrap_mode]! },
      { label: 'Autowrap Trim Flags', value: String(properties.autowrap_trim_flags) },
      { label: 'Justification Flags', value: String(properties.justification_flags) },
      { label: 'Uppercase', value: properties.uppercase ? 'On' : 'Off' },
      { label: 'Offset', value: `${properties.offset.x}, ${properties.offset.y}` },
    ],
  });

  const colorItems: PropertySection['items'] = [
    {
      label: 'Modulate',
      value: formatColorRgba(properties.modulate),
    },
  ];

  sections.push({
    title: 'Color',
    items: colorItems,
  });

  if (properties.outline_size > 0) {
    const outlineItems: PropertySection['items'] = [
      { label: 'Outline Size', value: properties.outline_size.toFixed(0) },
      {
        label: 'Outline Color',
        value: formatColorRgba(properties.outline_modulate),
      },
    ];

    sections.push({
      title: 'Outline',
      items: outlineItems,
    });
  }

  sections.push(...formatNode3DProperties(properties));

  return sections;
}
