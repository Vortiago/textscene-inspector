/** BoxMesh decode: property bag in, box size and subdivisions out. */

import type { BoxMeshProperties } from './types';
import { warn } from '../../../logger';
import { parseVector3, type Vector3 } from '../../../parser/vectors';
import { flooredCount } from '../meshCounts';

export function decodeBoxMesh(properties: Record<string, string>): BoxMeshProperties {
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
    subdivideWidth: flooredCount(properties.subdivide_width, 0, 0, 'BoxMesh subdivideWidth'),
    subdivideHeight: flooredCount(properties.subdivide_height, 0, 0, 'BoxMesh subdivideHeight'),
    subdivideDepth: flooredCount(properties.subdivide_depth, 0, 0, 'BoxMesh subdivideDepth'),
  };
}
