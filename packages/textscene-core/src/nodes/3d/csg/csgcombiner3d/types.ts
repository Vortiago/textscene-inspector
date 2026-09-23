/** CSGCombiner3D type definitions. */

import type { Node3DProperties } from '../../../base/node3d/types';

/**
 * CSGCombiner3D derives from CSGShape3D and adds nothing: an empty class body and constructor,
 * and a `_build_brush()` that returns an empty brush (csg_shape.cpp:1072-1077). It has no
 * geometry builder: its shape is the boolean fold of its CSG children, and its `operation` says
 * how that fold combines into its own parent.
 */
export interface CSGCombiner3DProperties extends Node3DProperties {
  /** CSG boolean operation: 0 UNION, 1 INTERSECTION, 2 SUBTRACTION. */
  operation?: number;
  /** `cast_shadow`: GeometryInstance3D state (`modules/csg/csg_shape.h:47`). */
  castShadow?: number;
}
