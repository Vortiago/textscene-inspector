/** CSGCombiner3D parser - parses CSGCombiner3D nodes from TSCN. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseNode3D } from '../../../base/node3d/parser';
import { finishCsgShapeParse } from '../sharedParser';
import type { CSGCombiner3DProperties } from './types';

export function parseCSGCombiner3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CSGCombiner3DProperties {
  const result: CSGCombiner3DProperties = { ...parseNode3D(heading, properties) };

  // The CSGShape3D half only: `finishCsgParse` also copies the `material` path, which a
  // combiner does not have (it is a CSGShape3D, not a CSGPrimitive3D).
  finishCsgShapeParse(result, properties);

  return result;
}
