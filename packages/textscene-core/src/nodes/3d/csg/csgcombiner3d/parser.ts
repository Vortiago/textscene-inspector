/** CSGCombiner3D parser - parses CSGCombiner3D nodes from TSCN. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseGeometryInstance3D } from '../../geometryinstance3d/parser';
import { finishCsgShapeParse } from '../shapeParser';
import type { CSGCombiner3DProperties } from './types';

export function parseCSGCombiner3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CSGCombiner3DProperties {
  const result: CSGCombiner3DProperties = { ...parseGeometryInstance3D(heading, properties) };

  // The CSGShape3D half only, from its own module: `finishCsgParse` also copies
  // the material slot, which a combiner does not have (csg_shape.h:194-202).
  finishCsgShapeParse(result, properties);

  return result;
}
