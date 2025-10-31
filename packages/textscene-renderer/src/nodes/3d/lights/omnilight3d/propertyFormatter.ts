/**
 * OmniLight3D property formatter - formats omnidirectional light properties for display.
 */

import type { PropertySection } from '../../../../core/NodeRegistry';
import type { OmniLight3DProperties } from './types';
import { formatNode3DProperties } from '../../../base/node3d/propertyFormatter';

export function formatOmniLight3DProperties(properties: OmniLight3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  const lightItems: PropertySection['items'] = [
    { label: 'Color', value: properties.light_color },
    { label: 'Energy', value: properties.light_energy.toFixed(2) },
    { label: 'Range', value: properties.omni_range.toFixed(2) },
    { label: 'Attenuation', value: properties.omni_attenuation.toFixed(2) },
  ];

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

  if (properties.shadow_normal_bias !== undefined) {
    shadowItems.push({ label: 'Normal Bias', value: properties.shadow_normal_bias.toFixed(3) });
  }

  if (properties.shadow_filter !== undefined) {
    shadowItems.push({ label: 'Filter', value: properties.shadow_filter.toString() });
  }

  if (properties.omni_shadow_mode !== undefined) {
    const shadowModes = ['DUAL_PARABOLOID', 'CUBE'];
    shadowItems.push({
      label: 'Shadow Mode',
      value: shadowModes[properties.omni_shadow_mode] || `Unknown (${properties.omni_shadow_mode})`,
    });
  }

  sections.push({
    title: 'Shadows',
    items: shadowItems,
  });

  // Include inherited Node3D transform properties
  sections.push(...formatNode3DProperties(properties));

  return sections;
}
