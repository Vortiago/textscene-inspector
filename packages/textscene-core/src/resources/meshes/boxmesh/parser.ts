/**
 * BoxMesh parser - parses BoxMesh resources from TSCN.
 */

import type { BoxMeshProperties, Vector3 } from './types';
import { warn } from '../../../logger';
import { parseVector3 } from '../../../parser/vectors';
import { intOr } from '../../../parser/valueParsers';

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

  return {
    size,
    subdivideWidth: intOr(properties.subdivide_width, 0, 'BoxMesh subdivideWidth'),
    subdivideHeight: intOr(properties.subdivide_height, 0, 'BoxMesh subdivideHeight'),
    subdivideDepth: intOr(properties.subdivide_depth, 0, 'BoxMesh subdivideDepth'),
  };
}
