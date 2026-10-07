/** CSGCombiner3D type definitions. */

import type { CSGShape3DProperties } from '../types';

/**
 * CSGCombiner3D derives from CSGShape3D and adds nothing: an empty class body and constructor,
 * and a `_build_brush()` that returns an empty brush (csg_shape.cpp:1072-1077). It has no
 * geometry builder: its shape is the boolean fold of its CSG children, and its `operation` says
 * how that fold combines into its own parent.
 */
export type CSGCombiner3DProperties = CSGShape3DProperties;
