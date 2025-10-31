import type { PrismMeshProperties } from './types';
import { parseVector3, type Vector3 } from '../../../parser/vectors';
import { warn } from '../../../logger';

export function parsePrismMesh(properties: Record<string, string>): PrismMeshProperties {
  let leftToRight = 0.5;
  let size: Vector3 = { x: 2, y: 2, z: 2 };
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
    const parsed = parseInt(properties.subdivide_width, 10);
    if (isNaN(parsed)) {
      warn(`Invalid PrismMesh subdivide_width: ${properties.subdivide_width}`);
    } else {
      subdivideWidth = parsed;
    }
  }

  if (properties.subdivide_height) {
    const parsed = parseInt(properties.subdivide_height, 10);
    if (isNaN(parsed)) {
      warn(`Invalid PrismMesh subdivide_height: ${properties.subdivide_height}`);
    } else {
      subdivideHeight = parsed;
    }
  }

  if (properties.subdivide_depth) {
    const parsed = parseInt(properties.subdivide_depth, 10);
    if (isNaN(parsed)) {
      warn(`Invalid PrismMesh subdivide_depth: ${properties.subdivide_depth}`);
    } else {
      subdivideDepth = parsed;
    }
  }

  return { leftToRight, size, subdivideWidth, subdivideHeight, subdivideDepth };
}
