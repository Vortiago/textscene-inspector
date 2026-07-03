/** CSGCylinder3D parser - parses CSGCylinder3D nodes from TSCN. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { CSGCylinder3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { finishCsgParse } from '../sharedParser';
import { floatOr, intOr } from '../../../../parser/valueParsers';

const DEFAULTS = { radius: 1, height: 1, sides: 8, cone: false } as const;

export function parseCSGCylinder3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CSGCylinder3DProperties {
  const node3d = parseNode3D(heading, properties);

  const result: CSGCylinder3DProperties = {
    ...node3d,
    radius: floatOr(properties.radius, DEFAULTS.radius, 'CSGCylinder3D'),
    height: floatOr(properties.height, DEFAULTS.height, 'CSGCylinder3D'),
    sides: intOr(properties.sides, DEFAULTS.sides, 'CSGCylinder3D'),
    cone: properties.cone === undefined ? DEFAULTS.cone : properties.cone === 'true',
  };

  finishCsgParse(result, properties, 'CSGCylinder3D', 'cylinder');

  return result;
}
