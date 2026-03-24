/**
 * BoxMesh parser - parses BoxMesh resources from TSCN.
 */

import type { BoxMeshProperties } from './types';
import type { Vector3 } from '../../../parser/vectors';
import { parseVector3 } from '../../../parser/vectors';
import { warn } from '../../../logger';

/**
 * Parse BoxMesh properties from TSCN sub_resource data.
 */
export function parseBoxMesh(properties: Record<string, string>): BoxMeshProperties {
  let size: Vector3 = { x: 1, y: 1, z: 1 }; // Godot default

  if (properties.size) {
    try {
      size = parseVector3(properties.size);
    } catch (error) {
      warn(
        `Failed to parse BoxMesh size: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return { size };
}
