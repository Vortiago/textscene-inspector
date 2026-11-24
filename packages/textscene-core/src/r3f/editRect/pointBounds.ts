import type { Rect2 } from '../../godot/math/rect2.js';
import type { Vector2 } from '../../godot/math/vector.js';

/** The bounds of packed x, y pairs moved by `offset`, or null for none. */
export function pointBounds(points: ArrayLike<number>, offset: Vector2 = { x: 0, y: 0 }): Rect2 | null {
  if (points.length < 2) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = points[i]! + offset.x;
    const y = points[i + 1]! + offset.y;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** A zero size draws as 1x1 (sprite_2d.cpp:456-458, animated_sprite_2d.cpp:108-110). */
export const atLeastOnePixel = (w: number, h: number) => (w === 0 && h === 0 ? { w: 1, h: 1 } : { w, h });
