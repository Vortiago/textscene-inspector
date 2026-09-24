/** SpotLight3D parser: the Light3D surface plus the cone properties. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { SpotLight3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { parseBaseLightProperties } from '../shared/parser';
import { floatOr } from '../../../../parser/valueParsers';

export function parseSpotLight3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): SpotLight3DProperties {
  const node3dProps = parseNode3D(heading, properties);
  const baseLightProps = parseBaseLightProperties(properties);

  return {
    ...node3dProps,
    ...baseLightProps,
    spot_range: floatOr(properties.spot_range, 5.0, 'spot_range'),
    spot_angle: floatOr(properties.spot_angle, 45.0, 'spot_angle'),
    spot_attenuation: floatOr(properties.spot_attenuation, 1.0, 'spot_attenuation'),
    spot_angle_attenuation: floatOr(properties.spot_angle_attenuation, 1.0, 'spot_angle_attenuation'),
  };
}
