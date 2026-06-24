/**
 * Label3D property formatter - formats label properties for display
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { Label3DProperties } from './types';
import { BillboardMode } from './types';
import { formatColorRgba } from '../../../utils/colorParser';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';

export function formatLabel3DProperties(properties: Label3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  // Text section
  const textItems: PropertySection['items'] = [
    { label: 'Text', value: properties.text || '(empty)' },
    { label: 'Pixel Size', value: properties.pixel_size.toFixed(4) },
    { label: 'Billboard', value: getBillboardModeName(properties.billboard) },
  ];

  sections.push({
    title: 'Text',
    items: textItems,
  });

  // Color section
  const colorItems: PropertySection['items'] = [
    {
      label: 'Modulate',
      value: formatColorRgba(properties.modulate)
    },
  ];

  sections.push({
    title: 'Color',
    items: colorItems,
  });

  // Outline section (only if enabled)
  if (properties.outline_size > 0) {
    const outlineItems: PropertySection['items'] = [
      { label: 'Outline Size', value: properties.outline_size.toFixed(0) },
      {
        label: 'Outline Color',
        value: formatColorRgba(properties.outline_modulate)
      },
    ];

    sections.push({
      title: 'Outline',
      items: outlineItems,
    });
  }

  // Include inherited Node3D transform properties
  sections.push(...formatNode3DProperties(properties));

  return sections;
}

function getBillboardModeName(mode: BillboardMode): string {
  switch (mode) {
    case BillboardMode.BILLBOARD_DISABLED:
      return 'Disabled';
    case BillboardMode.BILLBOARD_ENABLED:
      return 'Enabled';
    case BillboardMode.BILLBOARD_FIXED_Y:
      return 'Y-Axis Only';
    case BillboardMode.BILLBOARD_PARTICLES:
      return 'Particles (Unsupported)';
    default:
      return 'Unknown';
  }
}
