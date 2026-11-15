/**
 * The Shape3D kind: a collision shape from any origin. The gizmos of a CollisionShape3D and a
 * ShapeCast3D read the class and the property strings, so the value is the resource as written.
 * THREE-free and React-free.
 */

import type { ResourceKind } from '../../reading';

/** The classes of Godot's `Shape3D` that the gizmos draw. */
const SHAPE_3D_CLASSES = [
  'BoxShape3D',
  'CapsuleShape3D',
  'SphereShape3D',
  'CylinderShape3D',
  'WorldBoundaryShape3D',
  'HeightMapShape3D',
  'SeparationRayShape3D',
  'ConcavePolygonShape3D',
  'ConvexPolygonShape3D',
] as const;

export type Shape3DClass = (typeof SHAPE_3D_CLASSES)[number];

export interface Shape3DResource {
  readonly type: Shape3DClass;
  readonly data: Readonly<Record<string, string>>;
}

function isShape3DClass(type: string): type is Shape3DClass {
  return (SHAPE_3D_CLASSES as readonly string[]).includes(type);
}

/** A collision shape from any origin. `shape` of a CollisionShape3D and a ShapeCast3D takes a `Ref<Shape3D>`. */
export const SHAPE_3D: ResourceKind<Shape3DResource> = {
  name: 'Shape3D',
  accepts: isShape3DClass,
  decode: ({ type, properties }) => (isShape3DClass(type) ? { type, data: properties } : null),
};
