import type { Rect2 } from '../../../godot/math/rect2.js';
import type { Vector2 } from '../../../godot/math/vector.js';
import { frameSizePx, type SpriteFrameProps } from '../../../r3f/spriteFrame.js';
import { atLeastOnePixel } from '../../../r3f/editRect/pointBounds.js';

/** `Sprite2D::get_rect` (sprite_2d.cpp:439-461). Null is no texture, so `_edit_use_rect` is false. */
export function sprite2DEditRect(
  textureSize: { width: number; height: number } | undefined,
  props: SpriteFrameProps & { centered: boolean; offset: Vector2 }
): Rect2 | null {
  if (!textureSize) return null;
  // The frame is a `Size2i` (sprite_2d.cpp:444-452).
  const frame = frameSizePx(textureSize, props);
  const w = Math.trunc(frame.width);
  const h = Math.trunc(frame.height);
  const x = props.offset.x - (props.centered ? w / 2 : 0);
  const y = props.offset.y - (props.centered ? h / 2 : 0);
  return { x, y, ...atLeastOnePixel(w, h) };
}

/** The rect a viewport that snaps 2D transforms to pixels gives (sprite_2d.cpp:138-140). */
export function pixelSnappedRect(rect: Rect2 | null): Rect2 | null {
  if (!rect) return null;
  return { ...rect, x: Math.floor(rect.x + 0.5), y: Math.floor(rect.y + 0.5) };
}
