/** Godot 4.6.3's PathFollow3D facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `PathFollow3D::RotationMode` (`scene/3d/path_3d.h:76-82`). */
const RotationMode = {
  NONE: 0,
  Y: 1,
  XY: 2,
  XYZ: 3,
  ORIENTED: 4,
} as const;

/** Each rotation mode by its integer, spelled as its constant without `ROTATION_` (`path_3d.cpp:436`). */
export const PATH_FOLLOW_3D_ROTATION_MODE_NAMES = enumNamesByValue(RotationMode);
