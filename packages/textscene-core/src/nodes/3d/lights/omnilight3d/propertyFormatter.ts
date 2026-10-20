/** OmniLight3D property formatter: the inspector sections for the light. */

import type { PropertySection } from '../../../../core/NodeRegistry';
import type { OmniLight3DProperties } from './types';
import { formatNode3DProperties } from '../../../base/node3d/propertyFormatter';
import { OMNI_LIGHT_3D_SHADOW_MODE_NAMES } from '../../../../godot/scene/light';
import { formatBaseLightSection, formatShadowSectionWithNormalBias } from '../shared/propertyFormatter';

export function formatOmniLight3DProperties(properties: OmniLight3DProperties): PropertySection[] {
  const sections: PropertySection[] = [];

  const omniLightItems: PropertySection['items'] = [
    { label: 'Range', value: properties.omni_range.toFixed(2) },
    { label: 'Attenuation', value: properties.omni_attenuation.toFixed(2) },
  ];

  sections.push(formatBaseLightSection(properties, omniLightItems));

  const omniShadowItems: PropertySection['items'] = [];

  if (properties.omni_shadow_mode !== undefined) {
    omniShadowItems.push({
      label: 'Shadow Mode',
      value:
        OMNI_LIGHT_3D_SHADOW_MODE_NAMES[properties.omni_shadow_mode] ??
        `Unknown (${properties.omni_shadow_mode})`,
    });
  }

  sections.push(formatShadowSectionWithNormalBias(properties, omniShadowItems));

  sections.push(...formatNode3DProperties(properties));

  return sections;
}
