import type { PlaneMeshProperties } from './types';
import { parseVector2, parseVector3, type Vector2, type Vector3 } from '../../../parser/vectors';
import { warn } from '../../../logger';

/**
 * Defaults that differ between PlaneMesh (FACE_Y, 2×2) and its QuadMesh subclass
 * (FACE_Z, 1×1). Everything else is shared, so QuadMesh reuses this parser by
 * passing its own defaults rather than duplicating the field-by-field reading.
 */
export interface PlaneMeshDefaults {
  size: Vector2;
  orientation: number;
}

const PLANE_MESH_DEFAULTS: PlaneMeshDefaults = { size: { x: 2, y: 2 }, orientation: 1 };

export function parsePlaneMesh(
  properties: Record<string, string>,
  defaults: PlaneMeshDefaults = PLANE_MESH_DEFAULTS
): PlaneMeshProperties {
  let size: Vector2 = { ...defaults.size };
  let subdivideWidth = 0;
  let subdivideDepth = 0;
  let orientation = defaults.orientation;
  let centerOffset: Vector3 | undefined = undefined;
  let flipFaces = false;

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
      orientation = defaults.orientation;
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

  if (properties.flip_faces) {
    if (properties.flip_faces === 'true') {
      flipFaces = true;
    } else if (properties.flip_faces === 'false') {
      flipFaces = false;
    } else {
      warn(`Invalid PlaneMesh flip_faces: ${properties.flip_faces}, expected true or false`);
    }
  }

  return { size, subdivideWidth, subdivideDepth, orientation, centerOffset, flipFaces };
}
