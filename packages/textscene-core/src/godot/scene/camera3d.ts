/** Godot 4.6.3's Camera3D facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `Camera3D::ProjectionType` (`scene/3d/camera_3d.h:44-48`). */
const ProjectionType = {
  PERSPECTIVE: 0,
  ORTHOGONAL: 1,
  FRUSTUM: 2,
} as const;

/** Each projection type by its integer, spelled as its constant without `PROJECTION_`. */
export const CAMERA_3D_PROJECTION_NAMES = enumNamesByValue(ProjectionType);

/**
 * `Camera3D::KeepAspect` (`camera_3d.h:50-53`). It has two members and the hint at
 * `camera_3d.cpp:672` offers the same two, so a value of 2 is one the engine cannot represent.
 */
const KeepAspect = {
  KEEP_WIDTH: 0,
  KEEP_HEIGHT: 1,
} as const;

/** Each keep-aspect mode by its integer, spelled as its constant. */
export const CAMERA_3D_KEEP_ASPECT_NAMES = enumNamesByValue(KeepAspect);
