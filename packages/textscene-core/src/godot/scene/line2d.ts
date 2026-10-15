/** Godot 4.6.3's Line2D facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/**
 * `Line2D::LineJointMode` (`scene/2d/line_2d.h:40-44`), as the integers a `.tscn` stores for
 * `joint_mode`. Godot has no "no joint" mode, and the default is SHARP (`line_2d.h:130`).
 */
export const LineJointMode = {
  SHARP: 0,
  BEVEL: 1,
  ROUND: 2,
} as const;

/** Each joint mode's name by the integer a `.tscn` stores, as a validator names it. */
export const LINE_JOINT_MODE_NAMES = enumNamesByValue(LineJointMode);

/** `Line2D::LineCapMode` (`line_2d.h:46-50`), as the integers `begin_cap_mode` and `end_cap_mode` store. */
export const LineCapMode = {
  NONE: 0,
  BOX: 1,
  ROUND: 2,
} as const;

/** Each cap mode's name by the integer a `.tscn` stores, as a validator names it. */
export const LINE_CAP_MODE_NAMES = enumNamesByValue(LineCapMode);

/** `Line2D::LineTextureMode` (`line_2d.h:52-56`), as the integers `texture_mode` stores. */
export const LineTextureMode = {
  NONE: 0,
  TILE: 1,
  STRETCH: 2,
} as const;

/** Each texture mode's name by the integer a `.tscn` stores, as a validator names it. */
export const LINE_TEXTURE_MODE_NAMES = enumNamesByValue(LineTextureMode);
