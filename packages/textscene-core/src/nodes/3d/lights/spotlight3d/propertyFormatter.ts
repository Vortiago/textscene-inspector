/**
 * SpotLight3D property formatter - formats spotlight properties for display.
 */

import type { PropertySection } from '../../../../core/NodeRegistry';
import type { SpotLight3DProperties } from './types';
import { formatNode3DProperties } from '../../../base/node3d/propertyFormatter';

export function formatSpotLight3DProperties(properties: SpotLight3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  const lightItems: PropertySection['items'] = [
    { label: 'Color', value: properties.light_color },
    { label: 'Energy', value: properties.light_energy.toFixed(2) },
    { label: 'Range', value: properties.spot_range.toFixed(2) },
    { label: 'Angle', value: `${properties.spot_angle.toFixed(1)}°` },
  ];

  if (properties.penumbra !== undefined) {
    lightItems.push({ label: 'Penumbra', value: properties.penumbra.toFixed(2) });
  }

  sections.push({
    title: 'Light',
    items: lightItems,
  });

  const shadowItems: PropertySection['items'] = [
    { label: 'Enabled', value: properties.shadow_enabled ? 'Yes' : 'No' },
  ];

  if (properties.shadow_bias !== undefined) {
    shadowItems.push({ label: 'Bias', value: properties.shadow_bias.toFixed(3) });
  }

  if (properties.shadow_filter !== undefined) {
    shadowItems.push({ label: 'Filter', value: properties.shadow_filter.toString() });
  }

  sections.push({
    title: 'Shadows',
    items: shadowItems,
  });

  // Include inherited Node3D transform properties
  sections.push(...formatNode3DProperties(properties));

  return sections;
}
