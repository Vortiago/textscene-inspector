/** The Parallax2D property shape: a Node2D whose position `_update_scroll` replaces. */

import type { Node2DProperties } from '../../base/node2d/types';
import type { Vector2 } from '../../../godot/math/vector';

export interface Parallax2DProperties extends Node2DProperties {
  /** Multiplies the clamped screen offset. */
  scroll_scale: Vector2;
  /** Added to the scroll before the repeat wraps it. */
  scroll_offset: Vector2;
  /**
   * The authored value stands on the main 2D stage, and a sub-viewport's current Camera2D
   * overwrites it each pass.
   */
  screen_offset: Vector2;
  /** Repeat interval in pixels; an axis at 0 draws that axis once. */
  repeat_size: Vector2;
  /** Copies drawn past the first on each repeating axis; at least 1. */
  repeat_times: number;
  /** Per axis, the clamp applies only when `begin <= end - viewport size`. */
  limit_begin: Vector2;
  limit_end: Vector2;
  /** False subtracts the screen offset, so the node ignores the viewport's scroll. */
  follow_viewport: boolean;
  /** True keeps the camera from overwriting `screen_offset`. */
  ignore_camera_scroll: boolean;
}
