/**
 * SpotLight3D property formatter - formats spotlight properties for display.
 */

import type { PropertySection } from '../../../../core/NodeRegistry';
import type { SpotLight3DProperties } from './types';
import { formatNode3DProperties } from '../../../base/node3d/propertyFormatter';
import {
  formatBaseLightSection,
  formatBaseShadowSection,
} from '../shared/propertyFormatter';

export function formatSpotLight3DProperties(properties: SpotLight3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  // Base light section with spot-specific items
  const spotLightItems: PropertySection['items'] = [
    { label: 'Range', value: properties.spot_range.toFixed(2) },
    { label: 'Angle', value: `${properties.spot_angle.toFixed(1)}°` },
  ];

  if (properties.penumbra !== undefined) {
    spotLightItems.push({ label: 'Penumbra', value: properties.penumbra.toFixed(2) });
  }

  sections.push(formatBaseLightSection(properties, spotLightItems));

  // Base shadow section (SpotLight3D doesn't have shadow_normal_bias)
  sections.push(formatBaseShadowSection(properties));

  // Include inherited Node3D transform properties
  sections.push(...formatNode3DProperties(properties));

  return sections;
}
