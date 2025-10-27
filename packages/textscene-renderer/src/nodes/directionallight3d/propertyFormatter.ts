/**
 * DirectionalLight3D property formatter - formats directional light properties for display.
 */

import type { PropertySection } from '../../core/NodeRegistry';
import type { DirectionalLight3DProperties } from './types';
import { formatNode3DProperties } from '../node3d/propertyFormatter';

export function formatDirectionalLight3DProperties(properties: DirectionalLight3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  const lightItems: PropertySection['items'] = [
    { label: 'Color', value: properties.light_color },
    { label: 'Energy', value: properties.light_energy.toFixed(2) },
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

  if (properties.directional_shadow_mode !== undefined) {
    const shadowModes = ['ORTHOGONAL', 'PARALLEL_2_SPLITS', 'PARALLEL_4_SPLITS'];
    shadowItems.push({
      label: 'Shadow Mode',
      value: shadowModes[properties.directional_shadow_mode] || `Unknown (${properties.directional_shadow_mode})`,
    });
  }

  if (properties.directional_shadow_max_distance !== undefined) {
    shadowItems.push({ label: 'Max Distance', value: properties.directional_shadow_max_distance.toFixed(2) });
  }

  sections.push({
    title: 'Shadows',
    items: shadowItems,
  });

  // Include inherited Node3D transform properties
  sections.push(...formatNode3DProperties(properties));

  return sections;
}
