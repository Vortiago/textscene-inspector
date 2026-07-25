/** CSGBox3D parser - parses CSGBox3D nodes from TSCN. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { CSGBox3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { finishCsgParse } from '../sharedParser';
import { boolOr } from '../../../../parser/valueParsers';
import { parseVector3 } from '../../../../parser/vectors';
import { warn } from '../../../../logger';

/** Godot's own default (class_csgbox3d): `size = Vector3(1, 1, 1)`. */
const DEFAULT_SIZE = { x: 1, y: 1, z: 1 } as const;

export function parseCSGBox3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CSGBox3DProperties {
  const node3d = parseNode3D(heading, properties);

  let size: { x: number; y: number; z: number } = { ...DEFAULT_SIZE };
  if (properties.size) {
    try {
      size = parseVector3(properties.size);
    } catch (error) {
      warn(`[CSGBox3D] Failed to parse size: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const result: CSGBox3DProperties = {
    ...node3d,
    size,
    flipFaces: boolOr(properties.flip_faces, false, 'CSGBox3D flip_faces'),
  };

  finishCsgParse(result, properties);

  return result;
}
