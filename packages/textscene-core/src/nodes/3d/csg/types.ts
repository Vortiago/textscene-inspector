/** The `CSGShape3D` properties every CSG node type shares, combiner and primitives alike. */

import type { Node3DProperties } from '../../base/node3d/types';

export interface CSGShape3DProperties extends Node3DProperties {
  /** CSG boolean operation: 0 UNION, 1 INTERSECTION, 2 SUBTRACTION. */
  operation?: number;
  /** `cast_shadow`: GeometryInstance3D state (`modules/csg/csg_shape.h:47`). */
  castShadow?: number;
  /** `transparency`: GeometryInstance3D state, which only a root draws. */
  transparency?: number;
}
