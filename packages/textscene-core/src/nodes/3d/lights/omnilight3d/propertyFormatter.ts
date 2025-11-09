/**
 * OmniLight3D property formatter - formats omnidirectional light properties for display.
 */

import type { PropertySection } from '../../../../core/NodeRegistry';
import type { OmniLight3DProperties } from './types';
import { formatNode3DProperties } from '../../../base/node3d/propertyFormatter';
import {
  formatBaseLightSection,
  formatShadowSectionWithNormalBias,
} from '../shared/propertyFormatter';

export function formatOmniLight3DProperties(properties: OmniLight3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  // Base light section with omni-specific items
  const omniLightItems: PropertySection['items'] = [
    { label: 'Range', value: properties.omni_range.toFixed(2) },
    { label: 'Attenuation', value: properties.omni_attenuation.toFixed(2) },
  ];

  sections.push(formatBaseLightSection(properties, omniLightItems));

  // Shadow section with omni-specific items
  const omniShadowItems: PropertySection['items'] = [];

  if (properties.omni_shadow_mode !== undefined) {
    const shadowModes = ['DUAL_PARABOLOID', 'CUBE'];
    omniShadowItems.push({
      label: 'Shadow Mode',
      value: shadowModes[properties.omni_shadow_mode] || `Unknown (${properties.omni_shadow_mode})`,
    });
  }

  sections.push(formatShadowSectionWithNormalBias(properties, omniShadowItems));

  // Include inherited Node3D transform properties
  sections.push(...formatNode3DProperties(properties));

  return sections;
}
