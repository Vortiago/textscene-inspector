/**
 * BoxMesh parser - parses BoxMesh resources from TSCN.
 */

import type { BoxMeshProperties, Vector3 } from './types';
import { warn } from '../../../logger';
import { parseVector3 } from '../../../parser/vectors';

export { parseVector3 };

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

  const subdivide = (key: string): number => {
    const raw = properties[key];
    if (raw === undefined) return 0; // Godot default
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  return {
    size,
    subdivideWidth: subdivide('subdivide_width'),
    subdivideHeight: subdivide('subdivide_height'),
    subdivideDepth: subdivide('subdivide_depth'),
  };
}
