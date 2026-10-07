/**
 * The `CSGShape3D` properties every CSG node type shares, combiner and primitives alike.
 * `CSGShape3D : GeometryInstance3D` (`modules/csg/csg_shape.h:47`), and only a root draws its
 * GeometryInstance3D state.
 */

import type { GeometryInstance3DProperties } from '../geometryinstance3d/types';

export interface CSGShape3DProperties extends GeometryInstance3DProperties {
  /** CSG boolean operation: 0 UNION, 1 INTERSECTION, 2 SUBTRACTION. */
  operation?: number;
}

/** The fields `finishCsgShapeParse` writes onto any CSG parse result. */
export type CSGShapeFields = Pick<CSGShape3DProperties, 'operation'>;
