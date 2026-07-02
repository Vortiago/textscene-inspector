/** CSGBox3D parser - parses CSGBox3D nodes from TSCN. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { CSGBox3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { finishCsgParse } from '../sharedParser';
import { parseVector3 } from '../../../../parser/vectors';
import { warn } from '../../../../logger';

/** Godot CSGBox3D default size. */
const DEFAULT_SIZE = { x: 2, y: 2, z: 2 } as const;

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

  const result: CSGBox3DProperties = { ...node3d, size };

  finishCsgParse(result, properties, 'CSGBox3D', 'box');

  return result;
}
