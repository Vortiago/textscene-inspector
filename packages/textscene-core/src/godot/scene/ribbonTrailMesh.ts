/** Godot 4.6.3's RibbonTrailMesh facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `RibbonTrailMesh::Shape` (`scene/resources/3d/primitive_meshes.h:471-474`). */
export const RibbonTrailMeshShape = {
  FLAT: 0,
  CROSS: 1,
} as const;

export const RIBBON_TRAIL_MESH_SHAPE_NAMES = enumNamesByValue(RibbonTrailMeshShape);
