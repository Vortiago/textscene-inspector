import type { PrismMeshProperties } from './types';
import { parseVector3, type Vector3 } from '../../../parser/vectors';
import { warn } from '../../../logger';
import { floatOr, intOr } from '../../../parser/valueParsers';

export function parsePrismMesh(properties: Record<string, string>): PrismMeshProperties {
  let leftToRight = 0.5;
  let size: Vector3 = { x: 1, y: 1, z: 1 }; // Godot default
  let subdivideWidth = 0;
  let subdivideHeight = 0;
  let subdivideDepth = 0;

  if (properties.left_to_right) {
    const parsed = parseFloat(properties.left_to_right);
    if (isNaN(parsed)) {
      warn(`Invalid PrismMesh left_to_right: ${properties.left_to_right}`);
    } else {
      leftToRight = parsed;
    }
  }

  if (properties.size) {
    try {
      size = parseVector3(properties.size);
    } catch (error) {
      warn(
        `Failed to parse PrismMesh size: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (properties.subdivide_width) {
    subdivideWidth = intOr(properties.subdivide_width, 0, 'PrismMesh subdivideWidth');
  }

  if (properties.subdivide_height) {
    subdivideHeight = intOr(properties.subdivide_height, 0, 'PrismMesh subdivideHeight');
  }

  if (properties.subdivide_depth) {
    subdivideDepth = intOr(properties.subdivide_depth, 0, 'PrismMesh subdivideDepth');
  }

  return { leftToRight, size, subdivideWidth, subdivideHeight, subdivideDepth };
}
