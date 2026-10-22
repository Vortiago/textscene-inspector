/** Godot 4.6.3's PlaneMesh facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `PlaneMesh::Orientation` (`scene/resources/3d/primitive_meshes.h:245-249`, 4.7.2 `:246-250`). */
export const PlaneMeshOrientation = {
  FACE_X: 0,
  FACE_Y: 1,
  FACE_Z: 2,
} as const;

export const PLANE_MESH_ORIENTATION_NAMES = enumNamesByValue(PlaneMeshOrientation);
