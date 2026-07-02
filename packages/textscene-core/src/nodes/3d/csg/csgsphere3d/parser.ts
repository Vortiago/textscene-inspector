/** CSGSphere3D parser - parses CSGSphere3D nodes from TSCN. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { CSGSphere3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { finishCsgParse } from '../sharedParser';
import { floatOr, intOr } from '../../../../parser/valueParsers';

/** Godot CSGSphere3D defaults. */
const DEFAULTS = { radius: 0.5, radialSegments: 12, rings: 6 } as const;

export function parseCSGSphere3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CSGSphere3DProperties {
  const node3d = parseNode3D(heading, properties);

  const result: CSGSphere3DProperties = {
    ...node3d,
    radius: floatOr(properties.radius, DEFAULTS.radius, 'CSGSphere3D'),
    radialSegments: intOr(properties.radial_segments, DEFAULTS.radialSegments, 'CSGSphere3D'),
    rings: intOr(properties.rings, DEFAULTS.rings, 'CSGSphere3D'),
  };

  finishCsgParse(result, properties, 'CSGSphere3D', 'sphere');

  return result;
}
