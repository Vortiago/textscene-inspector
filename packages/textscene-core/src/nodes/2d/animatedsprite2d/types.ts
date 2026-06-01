/** AnimatedSprite2D — plays a SpriteFrames animation (extends Node2D). */

import type { Node2DProperties, Vector2 } from '../../base/node2d/types';

export interface AnimatedSprite2DProperties extends Node2DProperties {
  /** `SubResource("id")` / `ExtResource("id")` ref to the SpriteFrames resource. */
  sprite_frames?: string;
  /** Current animation name (the `&"name"` StringName, unwrapped). */
  animation?: string;
  /** Current frame index within the animation (default 0). */
  frame: number;
  centered: boolean;
  offset: Vector2;
  flip_h: boolean;
  flip_v: boolean;
  // `modulate` is inherited from Node2DProperties.
}
