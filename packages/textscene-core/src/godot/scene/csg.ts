/**
 * The CSG brush facts every CSG shape shares. Godot packs each brush into a manifold mesh, which
 * welds vertices and collapses edges within a tolerance before the brush gets its normals.
 */

/** `FLT_EPSILON`, the gap between 1 and the next single-precision float. */
const FLT_EPSILON = 2 ** -23;

/** `mesh.tolerance = 2 * FLT_EPSILON` (`csg_shape.cpp:427`), an absolute distance. */
export const CSG_MERGE_TOLERANCE = 2 * FLT_EPSILON;
