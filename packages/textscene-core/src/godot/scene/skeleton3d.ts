/** Godot 4.6.3's Skeleton3D facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `Skeleton3D::ModifierCallbackModeProcess` (`scene/3d/skeleton_3d.h:79-83`). */
const ModifierCallbackModeProcess = {
  PHYSICS: 0,
  IDLE: 1,
  MANUAL: 2,
} as const;

/** Each modifier callback mode by its integer, spelled as its constant without `MODIFIER_CALLBACK_MODE_PROCESS_` (`skeleton_3d.cpp:1307-1309`). */
export const MODIFIER_CALLBACK_MODE_PROCESS_NAMES = enumNamesByValue(ModifierCallbackModeProcess);
