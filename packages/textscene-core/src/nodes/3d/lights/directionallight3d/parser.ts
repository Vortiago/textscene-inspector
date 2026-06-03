/**
 * DirectionalLight3D parser - parses DirectionalLight3D nodes from TSCN.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import type { DirectionalLight3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { parseBaseLightWithNormalBias } from '../shared/parser';

export function parseDirectionalLight3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): DirectionalLight3DProperties {
  const node3dProps = parseNode3D(heading, properties);
  const baseLightProps = parseBaseLightWithNormalBias(properties);

  return {
    ...node3dProps,
    ...baseLightProps,
    directional_shadow_mode: properties.directional_shadow_mode
      ? parseInt(properties.directional_shadow_mode, 10)
      : undefined,
    directional_shadow_max_distance: properties.directional_shadow_max_distance
      ? parseFloat(properties.directional_shadow_max_distance)
      : undefined,
  };
}
