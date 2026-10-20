import type { PlaneMeshProperties } from './types';
import { enumOr, vec2Or, vec3Or } from '../../../parser/valueParsers';
import { flooredCount } from '../meshCounts';
import type { Vector2 } from '../../../godot/math/vector';
import { PlaneMeshOrientation } from '../../../godot/scene/planeMesh.js';
import { enumValues } from '../../../godot/classdb/enumNames.js';

/**
 * Defaults that differ between PlaneMesh (FACE_Y, 2×2) and its QuadMesh subclass
 * (FACE_Z, 1×1). Everything else is shared, so QuadMesh reuses this decode by
 * passing its own defaults rather than duplicating the field-by-field reading.
 */
export interface PlaneMeshDefaults {
  size: Vector2;
  orientation: PlaneMeshOrientation;
}

export const PLANE_MESH_DEFAULTS: PlaneMeshDefaults = {
  size: { x: 2, y: 2 },
  orientation: PlaneMeshOrientation.FACE_Y,
};

export function decodePlaneMesh(
  properties: Record<string, string>,
  defaults: PlaneMeshDefaults = PLANE_MESH_DEFAULTS
): PlaneMeshProperties {
  return {
    size: vec2Or(properties.size, defaults.size, 'PlaneMesh size'),
    subdivideWidth: flooredCount(properties.subdivide_width, 0, 0, 'PlaneMesh subdivideWidth'),
    subdivideDepth: flooredCount(properties.subdivide_depth, 0, 0, 'PlaneMesh subdivideDepth'),
    orientation: enumOr(
      properties.orientation,
      defaults.orientation,
      enumValues(PlaneMeshOrientation),
      'PlaneMesh orientation'
    ),
    centerOffset: vec3Or(properties.center_offset, { x: 0, y: 0, z: 0 }, 'PlaneMesh center_offset'),
  };
}
