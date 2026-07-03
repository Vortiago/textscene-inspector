import type { PlaneMeshProperties } from './types';
import { parseVector2, parseVector3, type Vector2, type Vector3 } from '../../../parser/vectors';
import { warn } from '../../../logger';
import { intOr } from '../../../parser/valueParsers';

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

  if (properties.subdivide_width !== undefined) {
    subdivideWidth = intOr(properties.subdivide_width, 0, 'PlaneMesh subdivideWidth');
  }
  if (properties.subdivide_depth !== undefined) {
    subdivideDepth = intOr(properties.subdivide_depth, 0, 'PlaneMesh subdivideDepth');
  }
  // orientation — intOr handles NaN, range check is specific to PlaneMesh
  if (properties.orientation !== undefined) {
    orientation = intOr(properties.orientation, defaults.orientation, 'PlaneMesh orientation');
    if (orientation < 0 || orientation > 2) {
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
