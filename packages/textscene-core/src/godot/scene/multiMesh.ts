/** Godot 4.6.3's MultiMesh facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `MultiMesh::TransformFormat` (`scene/resources/multimesh.h:41-44`). */
export enum MultiMeshTransformFormat {
  TRANSFORM_2D = 0,
  TRANSFORM_3D = 1,
}

/** `MultiMesh::PhysicsInterpolationQuality` without `INTERP_QUALITY_` (`multimesh.h:46-49`). */
const PhysicsInterpolationQuality = {
  FAST: 0,
  HIGH: 1,
} as const;

export const MULTI_MESH_TRANSFORM_FORMAT_NAMES = enumNamesByValue(MultiMeshTransformFormat);
export const MULTI_MESH_PHYSICS_INTERPOLATION_QUALITY_NAMES = enumNamesByValue(PhysicsInterpolationQuality);
