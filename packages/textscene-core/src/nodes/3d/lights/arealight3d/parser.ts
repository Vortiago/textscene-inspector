/**
 * AreaLight3D parser - parses AreaLight3D nodes from TSCN.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import type { AreaLight3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { parseBaseLightWithNormalBias } from '../shared/parser';

export function parseAreaLight3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): AreaLight3DProperties {
  const node3dProps = parseNode3D(heading, properties);
  const baseLightProps = parseBaseLightWithNormalBias(properties);

  return {
    ...node3dProps,
    ...baseLightProps,
    area_range: properties.area_range ? parseFloat(properties.area_range) : 1.0,
    area_size: properties.area_size ?? 'Vector2(1, 1)',
  };
}
