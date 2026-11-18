/** Godot 4.6.3's Camera3D facts a scene's properties carry. */

import { enumNamesByValue, labelEnumNames } from '../classdb/enumNames.js';

/** `Camera3D::ProjectionType` (`scene/3d/camera_3d.h:44-48`). */
export const Camera3DProjectionType = {
  PERSPECTIVE: 0,
  ORTHOGONAL: 1,
  FRUSTUM: 2,
} as const;

/** Each projection type by its integer, spelled as its constant without `PROJECTION_`. */
export const CAMERA_3D_PROJECTION_NAMES = enumNamesByValue(Camera3DProjectionType);

/** Each projection type by its integer, in the labels the inspector hint prints (`camera_3d.cpp:680`). */
export const CAMERA_3D_PROJECTION_HINT_NAMES = labelEnumNames(Camera3DProjectionType, {
  PERSPECTIVE: 'Perspective',
  ORTHOGONAL: 'Orthogonal',
  FRUSTUM: 'Frustum',
});

/**
 * `Camera3D::KeepAspect` (`camera_3d.h:50-53`). It has two members and the hint at
 * `camera_3d.cpp:672` offers the same two, so a value of 2 is one the engine cannot represent.
 */
export const Camera3DKeepAspect = {
  KEEP_WIDTH: 0,
  KEEP_HEIGHT: 1,
} as const;

/** Each keep-aspect mode by its integer, spelled as its constant. */
export const CAMERA_3D_KEEP_ASPECT_NAMES = enumNamesByValue(Camera3DKeepAspect);

/** Each keep-aspect mode by its integer, in the labels the inspector hint prints (`camera_3d.cpp:672`). */
export const CAMERA_3D_KEEP_ASPECT_HINT_NAMES = labelEnumNames(Camera3DKeepAspect, {
  KEEP_WIDTH: 'Keep Width',
  KEEP_HEIGHT: 'Keep Height',
});
