/** OccluderInstance3D parser: the Node3D parse plus the occluder it holds. */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
import type { OccluderInstance3DProperties } from './types';

export function parseOccluderInstance3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): OccluderInstance3DProperties {
  return { ...parseNode3D(heading, properties), occluder: properties.occluder };
}
