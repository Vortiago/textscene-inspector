/**
 * DirectionalLight3D property formatter - formats directional light properties for display.
 */

import type { PropertySection } from '../../../../core/NodeRegistry';
import type { DirectionalLight3DProperties } from './types';
import { formatNode3DProperties } from '../../../base/node3d/propertyFormatter';
import {
  formatBaseLightSection,
  formatShadowSectionWithNormalBias,
} from '../shared/propertyFormatter';

export function formatDirectionalLight3DProperties(properties: DirectionalLight3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  // Base light section
  sections.push(formatBaseLightSection(properties));

  // Shadow section with directional-specific items
  const directionalShadowItems: PropertySection['items'] = [];

  if (properties.directional_shadow_mode !== undefined) {
    const shadowModes = ['ORTHOGONAL', 'PARALLEL_2_SPLITS', 'PARALLEL_4_SPLITS'];
    directionalShadowItems.push({
      label: 'Shadow Mode',
      value: shadowModes[properties.directional_shadow_mode] || `Unknown (${properties.directional_shadow_mode})`,
    });
  }

  if (properties.directional_shadow_max_distance !== undefined) {
    directionalShadowItems.push({
      label: 'Max Distance',
      value: properties.directional_shadow_max_distance.toFixed(2),
    });
  }

  sections.push(formatShadowSectionWithNormalBias(properties, directionalShadowItems));

  // Include inherited Node3D transform properties
  sections.push(...formatNode3DProperties(properties));

  return sections;
}
