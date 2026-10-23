/**
 * The CSG brush facts every CSG shape shares. Godot packs each brush into a manifold mesh, which
 * welds vertices and collapses edges within a tolerance before the brush gets its normals, and
 * which is empty unless the brush is closed.
 */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `FLT_EPSILON`, the gap between 1 and the next single-precision float. */
const FLT_EPSILON = 2 ** -23;

/** `mesh.tolerance = 2 * FLT_EPSILON` (`csg_shape.cpp:425`), an absolute distance. */
export const CSG_MERGE_TOLERANCE = 2 * FLT_EPSILON;

/** `CSGShape3D::Operation` (`modules/csg/csg_shape.h:51-55`). */
export const CsgOperation = {
  UNION: 0,
  INTERSECTION: 1,
  SUBTRACTION: 2,
} as const;

/** Each boolean operation by its integer, spelled as its constant without `OPERATION_`. */
export const CSG_OPERATION_NAMES = enumNamesByValue(CsgOperation);

/** `CSGPolygon3D::Mode` (`csg_shape.h:372-376`). */
export const PolygonMode = {
  DEPTH: 0,
  SPIN: 1,
  PATH: 2,
} as const;

/** Each polygon mode by its integer, spelled as its constant without `MODE_`. */
export const CSG_POLYGON_MODE_NAMES = enumNamesByValue(PolygonMode);

/** `CSGPolygon3D::PathIntervalType` (`csg_shape.h:378-381`). */
export const PathIntervalType = {
  DISTANCE: 0,
  SUBDIVIDE: 1,
} as const;

/** Each path interval type by its integer, spelled as its constant without `PATH_INTERVAL_`. */
export const CSG_POLYGON_PATH_INTERVAL_TYPE_NAMES = enumNamesByValue(PathIntervalType);

/** `CSGPolygon3D::PathRotation` (`csg_shape.h:383-387`). */
export const PathRotation = {
  POLYGON: 0,
  PATH: 1,
  PATH_FOLLOW: 2,
} as const;

/** Each path rotation by its integer, spelled as its constant without `PATH_ROTATION_`. */
export const CSG_POLYGON_PATH_ROTATION_NAMES = enumNamesByValue(PathRotation);
