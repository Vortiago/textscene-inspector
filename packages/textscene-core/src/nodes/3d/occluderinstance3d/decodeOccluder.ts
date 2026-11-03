/**
 * Reads an Occluder3D sub-resource into the shape `occluderAabb` measures. Null for a resource of
 * another class, which Godot's `occluder` slot refuses.
 */

import type { OccluderShape } from '../../../godot/scene/occluder';
import type { Vector2, Vector3 } from '../../../godot/math/vector';
import type { TscnInternalResource } from '../../../parser/types';
import { floatOr, packedOr, vec2Or, vec3Or } from '../../../parser/valueParsers';
import {
  NO_FLOATS,
  parsePackedVector2Array,
  parsePackedVector3Array,
} from '../../../resources/shapes/packedArray';

/** The defaults of the class members (`occluder_instance_3d.h:89, 107, 127`). */
const DEFAULT_SIZE_2D: Vector2 = { x: 1, y: 1 };
const DEFAULT_SIZE_3D: Vector3 = { x: 1, y: 1, z: 1 };
const DEFAULT_RADIUS = 1;

function pairs(components: Float32Array): Vector2[] {
  return Array.from({ length: Math.floor(components.length / 2) }, (_, i) => ({
    x: components[i * 2]!,
    y: components[i * 2 + 1]!,
  }));
}

export function decodeOccluder({ type, data }: TscnInternalResource): OccluderShape | null {
  switch (type) {
    case 'BoxOccluder3D':
      return { kind: 'box', size: vec3Or(data.size, DEFAULT_SIZE_3D, 'BoxOccluder3D size') };
    case 'QuadOccluder3D':
      return { kind: 'quad', size: vec2Or(data.size, DEFAULT_SIZE_2D, 'QuadOccluder3D size') };
    case 'SphereOccluder3D':
      return { kind: 'sphere', radius: floatOr(data.radius, DEFAULT_RADIUS, 'SphereOccluder3D radius') };
    case 'PolygonOccluder3D':
      return {
        kind: 'polygon',
        polygon: pairs(
          packedOr(data.polygon, parsePackedVector2Array, NO_FLOATS, 'PolygonOccluder3D polygon')
        ),
      };
    case 'ArrayOccluder3D':
      return {
        kind: 'array',
        vertices: packedOr(data.vertices, parsePackedVector3Array, NO_FLOATS, 'ArrayOccluder3D vertices'),
      };
    default:
      return null;
  }
}
