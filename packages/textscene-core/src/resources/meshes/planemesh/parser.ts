import type { PlaneMeshProperties } from './types';
import { parseVector3, type Vector2, type Vector3 } from '../../../parser/vectors';
import { warn } from '../../../logger';
import { boolOr, enumOr, intOr, vec2Or } from '../../../parser/valueParsers';

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
  let centerOffset: Vector3 | undefined = undefined;

  if (properties.center_offset) {
    try {
      centerOffset = parseVector3(properties.center_offset);
    } catch (error) {
      warn(
        `Failed to parse PlaneMesh center_offset: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    size: vec2Or(properties.size, defaults.size, 'PlaneMesh size'),
    subdivideWidth: intOr(properties.subdivide_width, 0, 'PlaneMesh subdivideWidth'),
    subdivideDepth: intOr(properties.subdivide_depth, 0, 'PlaneMesh subdivideDepth'),
    orientation: enumOr(properties.orientation, defaults.orientation, [0, 1, 2], 'PlaneMesh orientation'),
    centerOffset,
    flipFaces: boolOr(properties.flip_faces, false, 'PlaneMesh flip_faces'),
  };
}
