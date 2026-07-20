/**
 * AreaLight3D parser - parses AreaLight3D nodes from TSCN.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import type { AreaLight3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { parseBaseLightWithNormalBias } from '../shared/parser';
import { boolOr, floatOr, vec2Or } from '../../../../parser/valueParsers';

export function parseAreaLight3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): AreaLight3DProperties {
  const node3dProps = parseNode3D(heading, properties);
  const baseLightProps = parseBaseLightWithNormalBias(properties);

  return {
    ...node3dProps,
    ...baseLightProps,
    // class_arealight3d.html: area_range 5.0, area_size Vector2(1, 1),
    // area_normalize_energy true.
    area_range: floatOr(properties.area_range, 5.0, 'AreaLight3D'),
    area_size: vec2Or(properties.area_size, { x: 1, y: 1 }, 'AreaLight3D'),
    area_normalize_energy: boolOr(properties.area_normalize_energy, true),
  };
}
