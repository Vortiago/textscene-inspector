/** CSGCombiner3D type definitions. */

import type { Node3DProperties } from '../../../base/node3d/types';

/**
 * CSGCombiner3D derives straight from CSGShape3D and adds nothing at all: an empty class
 * body, an empty constructor, and a `_build_brush()` that returns an empty brush
 * (csg_shape.cpp:1072-1077).
 *
 * There is deliberately **no geometry builder** for this slice, and adding one would be a
 * category error. A combiner has no shape of its own; it is the node whose boolean fold of
 * its CSG children BECOMES the shape. Its `operation` says how that fold combines into its
 * own parent.
 */
export interface CSGCombiner3DProperties extends Node3DProperties {
  /** CSG boolean operation: 0 UNION, 1 INTERSECTION, 2 SUBTRACTION. */
  operation?: number;
  /** `cast_shadow` — GeometryInstance3D state (`modules/csg/csg_shape.h:47`). */
  castShadow?: number;
}
