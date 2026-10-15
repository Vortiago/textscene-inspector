/** SpotLight3D parser: the Light3D surface plus the cone properties. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { SpotLight3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { parsePositionalLightProperties } from '../shared/parser';
import { floatOr } from '../../../../parser/valueParsers';
import { SPOT_LIGHT_3D_DEFAULTS } from '../../../../godot/scene/light';

export function parseSpotLight3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): SpotLight3DProperties {
  const node3dProps = parseNode3D(heading, properties);
  const baseLightProps = parsePositionalLightProperties(properties);

  return {
    ...node3dProps,
    ...baseLightProps,
    spot_range: floatOr(properties.spot_range, SPOT_LIGHT_3D_DEFAULTS.range, 'spot_range'),
    spot_angle: floatOr(properties.spot_angle, SPOT_LIGHT_3D_DEFAULTS.spotAngle, 'spot_angle'),
    spot_attenuation: floatOr(
      properties.spot_attenuation,
      SPOT_LIGHT_3D_DEFAULTS.attenuation,
      'spot_attenuation'
    ),
    spot_angle_attenuation: floatOr(
      properties.spot_angle_attenuation,
      SPOT_LIGHT_3D_DEFAULTS.spotAngleAttenuation,
      'spot_angle_attenuation'
    ),
  };
}
