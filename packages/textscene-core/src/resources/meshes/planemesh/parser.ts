import type { PlaneMeshProperties } from './types';
import { parseVector2, parseVector3, type Vector2, type Vector3 } from '../../../parser/vectors';
import { warn } from '../../../logger';

export function parsePlaneMesh(properties: Record<string, string>): PlaneMeshProperties {
  let size: Vector2 = { x: 2, y: 2 };
  let subdivideWidth = 0;
  let subdivideDepth = 0;
  let orientation = 1;
  let centerOffset: Vector3 | undefined = undefined;

  if (properties.size) {
    try {
      size = parseVector2(properties.size);
    } catch (error) {
      warn(
        `Failed to parse PlaneMesh size: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (properties.subdivide_width) {
    subdivideWidth = parseInt(properties.subdivide_width, 10);
    if (isNaN(subdivideWidth)) {
      warn(`Invalid PlaneMesh subdivide_width: ${properties.subdivide_width}`);
      subdivideWidth = 0;
    }
  }

  if (properties.subdivide_depth) {
    subdivideDepth = parseInt(properties.subdivide_depth, 10);
    if (isNaN(subdivideDepth)) {
      warn(`Invalid PlaneMesh subdivide_depth: ${properties.subdivide_depth}`);
      subdivideDepth = 0;
    }
  }

  if (properties.orientation) {
    orientation = parseInt(properties.orientation, 10);
    if (isNaN(orientation) || orientation < 0 || orientation > 2) {
      warn(`Invalid PlaneMesh orientation: ${properties.orientation}`);
      orientation = 1;
    }
  }

  if (properties.center_offset) {
    try {
      centerOffset = parseVector3(properties.center_offset);
    } catch (error) {
      warn(
        `Failed to parse PlaneMesh center_offset: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return { size, subdivideWidth, subdivideDepth, orientation, centerOffset };
}
