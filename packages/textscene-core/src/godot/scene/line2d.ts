/** Godot 4.6.3's Line2D facts a scene's properties carry. */

/**
 * `Line2D::LineJointMode` (`scene/2d/line_2d.h:39-43`), as the integers a `.tscn` stores for
 * `joint_mode`. Godot has no "no joint" mode, and the default is SHARP (`line_2d.h:130`).
 */
export const LineJointMode = {
  SHARP: 0,
  BEVEL: 1,
  ROUND: 2,
} as const;
