import type { Rect2 } from '../../../../godot/math/rect2.js';
import { packedOr } from '../../../../parser/valueParsers.js';
import { NO_FLOATS, parsePackedVector2Array } from '../../../../resources/shapes/packedArray.js';
import { pointBounds } from '../../../../r3f/editRect/pointBounds.js';

/** The `aabb` that `CollisionPolygon2D::set_polygon` keeps (collision_polygon_2d.cpp:172-189, .h:47). */
export function collisionPolygon2DEditRect(raw: Readonly<Record<string, string>>): Rect2 {
  const polygon = packedOr(raw.polygon, parsePackedVector2Array, NO_FLOATS, 'CollisionPolygon2D polygon');
  const bounds = pointBounds(polygon);
  if (!bounds || (bounds.x === 0 && bounds.y === 0 && bounds.w === 0 && bounds.h === 0)) {
    return { x: -10, y: -10, w: 20, h: 20 };
  }
  return { x: bounds.x - bounds.w * 0.3, y: bounds.y - bounds.h * 0.3, w: bounds.w * 1.6, h: bounds.h * 1.6 };
}
