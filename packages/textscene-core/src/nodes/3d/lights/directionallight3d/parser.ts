/** DirectionalLight3D parser: the Light3D surface plus the directional shadow. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { DirectionalLight3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { parseBaseLightWithNormalBias } from '../shared/parser';
import { parseOptionalFloat, parseOptionalInt } from '../../../../parser/valueParsers';

export function parseDirectionalLight3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): DirectionalLight3DProperties {
  const node3dProps = parseNode3D(heading, properties);
  const baseLightProps = parseBaseLightWithNormalBias(properties);

  return {
    ...node3dProps,
    ...baseLightProps,
    directional_shadow_mode: parseOptionalInt(properties.directional_shadow_mode),
    directional_shadow_max_distance: parseOptionalFloat(properties.directional_shadow_max_distance),
  };
}
