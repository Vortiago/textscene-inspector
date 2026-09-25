/** SpotLight3D property formatter: the inspector sections for the light. */

import type { PropertySection } from '../../../../core/NodeRegistry';
import type { SpotLight3DProperties } from './types';
import { formatNode3DProperties } from '../../../base/node3d/propertyFormatter';
import {
  formatBaseLightSection,
  formatBaseShadowSection,
} from '../shared/propertyFormatter';

export function formatSpotLight3DProperties(properties: SpotLight3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  const spotLightItems: PropertySection['items'] = [
    { label: 'Range', value: properties.spot_range.toFixed(2) },
    { label: 'Angle', value: `${properties.spot_angle.toFixed(1)}°` },
  ];

  if (properties.penumbra !== undefined) {
    spotLightItems.push({ label: 'Penumbra', value: properties.penumbra.toFixed(2) });
  }

  sections.push(formatBaseLightSection(properties, spotLightItems));

  // SpotLight3D has no shadow_normal_bias.
  sections.push(formatBaseShadowSection(properties));

  sections.push(...formatNode3DProperties(properties));

  return sections;
}
