/**
 * OmniLight3D parser - parses OmniLight3D nodes from TSCN.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import type { OmniLight3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { parseBaseLightWithNormalBias } from '../shared/parser';

export function parseOmniLight3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): OmniLight3DProperties {
  const node3dProps = parseNode3D(heading, properties);
  const baseLightProps = parseBaseLightWithNormalBias(properties);

  return {
    ...node3dProps,
    ...baseLightProps,
    omni_range: properties.omni_range ? parseFloat(properties.omni_range) : 5.0,
    omni_attenuation: properties.omni_attenuation ? parseFloat(properties.omni_attenuation) : 1.0,
    omni_shadow_mode: properties.omni_shadow_mode
      ? parseInt(properties.omni_shadow_mode, 10)
      : undefined,
  };
}
