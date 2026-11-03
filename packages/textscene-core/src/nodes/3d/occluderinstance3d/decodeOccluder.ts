/**
 * Reads an Occluder3D sub-resource into the shape `occluderAabb` measures. Null for a resource of
 * another class, which Godot's `occluder` slot refuses.
 */

import type { OccluderShape } from '../../../godot/scene/occluder';
import type { Vector2, Vector3 } from '../../../godot/math/vector';
import type { TscnInternalResource } from '../../../parser/types';
import { floatOr, packedOr, vec2Or, vec3Or } from '../../../parser/valueParsers';
import { parsePackedVector2Array, parsePackedVector3Array } from '../../../resources/shapes/packedArray';

const NO_COMPONENTS = new Float32Array(0);

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

function triples(components: Float32Array): Vector3[] {
  return Array.from({ length: Math.floor(components.length / 3) }, (_, i) => ({
    x: components[i * 3]!,
    y: components[i * 3 + 1]!,
    z: components[i * 3 + 2]!,
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
          packedOr(data.polygon, parsePackedVector2Array, NO_COMPONENTS, 'PolygonOccluder3D polygon')
        ),
      };
    case 'ArrayOccluder3D':
      return {
        kind: 'array',
        vertices: triples(
          packedOr(data.vertices, parsePackedVector3Array, NO_COMPONENTS, 'ArrayOccluder3D vertices')
        ),
      };
    default:
      return null;
  }
}
