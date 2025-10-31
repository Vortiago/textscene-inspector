/**
 * DirectionalLight3D parser - parses DirectionalLight3D nodes from TSCN.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import type { DirectionalLight3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';

export function parseDirectionalLight3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): DirectionalLight3DProperties {
  const node3dProps = parseNode3D(heading, properties);

  return {
    ...node3dProps,
    light_color: properties.light_color || 'Color(1, 1, 1, 1)',
    light_energy: properties.light_energy ? parseFloat(properties.light_energy) : 1.0,
    shadow_enabled: properties.shadow_enabled === 'true',
    shadow_bias: properties.shadow_bias ? parseFloat(properties.shadow_bias) : undefined,
    shadow_normal_bias: properties.shadow_normal_bias
      ? parseFloat(properties.shadow_normal_bias)
      : undefined,
    shadow_filter: properties.shadow_filter ? parseInt(properties.shadow_filter, 10) : undefined,
    directional_shadow_mode: properties.directional_shadow_mode
      ? parseInt(properties.directional_shadow_mode, 10)
      : undefined,
    directional_shadow_max_distance: properties.directional_shadow_max_distance
      ? parseFloat(properties.directional_shadow_max_distance)
      : undefined,
  };
}

export function isDirectionalLight3D(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'DirectionalLight3D';
}
