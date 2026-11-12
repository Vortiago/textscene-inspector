/**
 * The Occluder3D kind: an occluder from any origin, as the shape `occluderAabb` measures. Any other
 * class is refused, as the `occluder` slot of Godot refuses it.
 */

import type { OccluderShape } from '../../../godot/scene/occluder';
import type { Vector2, Vector3 } from '../../../godot/math/vector';
import { floatOr, packedOr, vec2Or, vec3Or } from '../../../parser/valueParsers';
import type { ResourceKind } from '../../../resources/reading';
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

type Properties = Readonly<Record<string, string>>;

const DECODERS: Readonly<Record<string, (data: Properties) => OccluderShape>> = {
  BoxOccluder3D: (data) => ({ kind: 'box', size: vec3Or(data.size, DEFAULT_SIZE_3D, 'BoxOccluder3D size') }),
  QuadOccluder3D: (data) => ({
    kind: 'quad',
    size: vec2Or(data.size, DEFAULT_SIZE_2D, 'QuadOccluder3D size'),
  }),
  SphereOccluder3D: (data) => ({
    kind: 'sphere',
    radius: floatOr(data.radius, DEFAULT_RADIUS, 'SphereOccluder3D radius'),
  }),
  PolygonOccluder3D: (data) => ({
    kind: 'polygon',
    polygon: pairs(packedOr(data.polygon, parsePackedVector2Array, NO_FLOATS, 'PolygonOccluder3D polygon')),
  }),
  ArrayOccluder3D: (data) => ({
    kind: 'array',
    vertices: packedOr(data.vertices, parsePackedVector3Array, NO_FLOATS, 'ArrayOccluder3D vertices'),
  }),
};

export const OCCLUDER_3D: ResourceKind<OccluderShape> = {
  name: 'Occluder3D',
  accepts: (type) => Object.hasOwn(DECODERS, type),
  decode: ({ type, properties }) => DECODERS[type]!(properties),
};
