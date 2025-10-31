/**
 * OmniLight3D parser - parses OmniLight3D nodes from TSCN.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import type { OmniLight3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';

export function parseOmniLight3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): OmniLight3DProperties {
  const node3dProps = parseNode3D(heading, properties);

  return {
    ...node3dProps,
    light_color: properties.light_color || 'Color(1, 1, 1, 1)',
    light_energy: properties.light_energy ? parseFloat(properties.light_energy) : 1.0,
    omni_range: properties.omni_range ? parseFloat(properties.omni_range) : 5.0,
    omni_attenuation: properties.omni_attenuation ? parseFloat(properties.omni_attenuation) : 1.0,
    shadow_enabled: properties.shadow_enabled === 'true',
    shadow_bias: properties.shadow_bias ? parseFloat(properties.shadow_bias) : undefined,
    shadow_normal_bias: properties.shadow_normal_bias
      ? parseFloat(properties.shadow_normal_bias)
      : undefined,
    shadow_filter: properties.shadow_filter ? parseInt(properties.shadow_filter, 10) : undefined,
    omni_shadow_mode: properties.omni_shadow_mode
      ? parseInt(properties.omni_shadow_mode, 10)
      : undefined,
  };
}

export function isOmniLight3D(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'OmniLight3D';
}
