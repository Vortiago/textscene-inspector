/** OmniLight3D parser: the Light3D surface plus range, attenuation and shadow mode. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { OmniLight3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { parseBaseLightWithNormalBias } from '../shared/parser';
import { floatOr, parseOptionalInt } from '../../../../parser/valueParsers';

export function parseOmniLight3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): OmniLight3DProperties {
  const node3dProps = parseNode3D(heading, properties);
  const baseLightProps = parseBaseLightWithNormalBias(properties);

  return {
    ...node3dProps,
    ...baseLightProps,
    omni_range: floatOr(properties.omni_range, 5.0, 'omni_range'),
    omni_attenuation: floatOr(properties.omni_attenuation, 1.0, 'omni_attenuation'),
    omni_shadow_mode: parseOptionalInt(properties.omni_shadow_mode),
  };
}
