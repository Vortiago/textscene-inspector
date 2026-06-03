/**
 * SpotLight3D parser - parses SpotLight3D nodes from TSCN.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import type { SpotLight3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { parseBaseLightProperties } from '../shared/parser';

export function parseSpotLight3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): SpotLight3DProperties {
  const node3dProps = parseNode3D(heading, properties);
  const baseLightProps = parseBaseLightProperties(properties);

  return {
    ...node3dProps,
    ...baseLightProps,
    spot_range: properties.spot_range ? parseFloat(properties.spot_range) : 5.0,
    spot_angle: properties.spot_angle ? parseFloat(properties.spot_angle) : 45.0,
  };
}
