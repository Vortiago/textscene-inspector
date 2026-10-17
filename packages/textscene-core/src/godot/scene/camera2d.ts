/** Godot 4.6.3's Camera2D facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `Camera2D::AnchorMode` (`scene/2d/camera_2d.h:39-42`). */
const AnchorMode = {
  FIXED_TOP_LEFT: 0,
  DRAG_CENTER: 1,
} as const;

/** Each anchor mode by its integer, spelled as its constant (`camera_2d.cpp:961` is the hint site). */
export const CAMERA_2D_ANCHOR_MODE_NAMES = enumNamesByValue(AnchorMode);

/** `Camera2D::Camera2DProcessCallback` (`camera_2d.h:44-47`), as `CAMERA2D_PROCESS_<name>`. */
const ProcessCallback = {
  PHYSICS: 0,
  IDLE: 1,
} as const;

/** Each process callback by its integer, spelled as its constant (`camera_2d.cpp:966` is the hint site). */
export const CAMERA_2D_PROCESS_CALLBACK_NAMES = enumNamesByValue(ProcessCallback);
