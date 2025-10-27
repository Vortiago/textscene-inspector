/**
 * SpotLight3D parser - parses SpotLight3D nodes from TSCN.
 */

import type { ParsedHeading } from '../../parser/utils';
import type { SpotLight3DProperties } from './types';
import { parseNode3D } from '../node3d/parser';

export function parseSpotLight3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): SpotLight3DProperties {
  const node3dProps = parseNode3D(heading, properties);

  return {
    ...node3dProps,
    light_color: properties.light_color || 'Color(1, 1, 1, 1)',
    light_energy: properties.light_energy ? parseFloat(properties.light_energy) : 1.0,
    spot_range: properties.spot_range ? parseFloat(properties.spot_range) : 5.0,
    spot_angle: properties.spot_angle ? parseFloat(properties.spot_angle) : 45.0,
    shadow_enabled: properties.shadow_enabled === 'true',
    shadow_bias: properties.shadow_bias ? parseFloat(properties.shadow_bias) : undefined,
    shadow_filter: properties.shadow_filter ? parseInt(properties.shadow_filter, 10) : undefined,
  };
}

export function isSpotLight3D(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'SpotLight3D';
}
