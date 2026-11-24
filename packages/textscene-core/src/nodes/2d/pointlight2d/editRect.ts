import type { Rect2 } from '../../../godot/math/rect2.js';
import type { Vector2 } from '../../../godot/math/vector.js';

/** light_2d.cpp:370-381. Null is no texture. */
export function pointLight2DEditRect(
  textureSize: { width: number; height: number } | undefined,
  scale: number,
  offset: Vector2
): Rect2 | null {
  if (!textureSize) return null;
  const w = textureSize.width * scale;
  const h = textureSize.height * scale;
  return { x: offset.x - w / 2, y: offset.y - h / 2, w, h };
}
