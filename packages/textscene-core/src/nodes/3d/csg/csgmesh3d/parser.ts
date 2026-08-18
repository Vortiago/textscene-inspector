/** CSGMesh3D parser - parses CSGMesh3D nodes from TSCN. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseNode3D } from '../../../base/node3d/parser';
import { finishCsgParse } from '../sharedParser';
import { boolOr } from '../../../../parser/valueParsers';
import type { CSGMesh3DProperties } from './types';

export function parseCSGMesh3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CSGMesh3DProperties {
  const node3d = parseNode3D(heading, properties);

  const result: CSGMesh3DProperties = {
    ...node3d,
    flipFaces: boolOr(properties.flip_faces, false, 'CSGMesh3D flip_faces'),
  };

  if (properties.mesh) result.mesh = properties.mesh;

  // finishCsgParse copies the `material` path and `operation`.
  finishCsgParse(result, properties);

  return result;
}
