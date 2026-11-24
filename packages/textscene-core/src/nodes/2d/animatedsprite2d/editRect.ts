import type { Rect2 } from '../../../godot/math/rect2.js';
import type { Vector2 } from '../../../godot/math/vector.js';
import { atLeastOnePixel } from '../../../r3f/editRect/pointBounds.js';

/** `AnimatedSprite2D::_get_rect` (animated_sprite_2d.cpp:86-113). Null is no frame texture. */
export function animatedSprite2DEditRect(
  frameSize: { width: number; height: number } | undefined,
  centered: boolean,
  offset: Vector2
): Rect2 | null {
  if (!frameSize) return null;
  const { width, height } = frameSize;
  const x = offset.x - (centered ? width / 2 : 0);
  const y = offset.y - (centered ? height / 2 : 0);
  return { x, y, ...atLeastOnePixel(width, height) };
}
