import type { PrismMeshProperties } from './types';
import { parseVector3, type Vector3 } from '../../../parser/vectors';
import { warn } from '../../../logger';
import { floatOr, intOr } from '../../../parser/valueParsers';

export function parsePrismMesh(properties: Record<string, string>): PrismMeshProperties {
  let size: Vector3 = { x: 1, y: 1, z: 1 }; // Godot default

  if (properties.size) {
    try {
      size = parseVector3(properties.size);
    } catch (error) {
      warn(
        `Failed to parse PrismMesh size: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    leftToRight: floatOr(properties.left_to_right, 0.5, 'PrismMesh leftToRight'),
    size,
    subdivideWidth: intOr(properties.subdivide_width, 0, 'PrismMesh subdivideWidth'),
    subdivideHeight: intOr(properties.subdivide_height, 0, 'PrismMesh subdivideHeight'),
    subdivideDepth: intOr(properties.subdivide_depth, 0, 'PrismMesh subdivideDepth'),
  };
}
