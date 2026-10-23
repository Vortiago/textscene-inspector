/**
 * A texture-pixel region as three's UV window. Godot's image `y` runs top-down and three's `v`
 * runs bottom-up, so the region's bottom edge sets the `v` offset.
 */

import type { Rect2 } from '../godot/math/rect2';
import type { Vector2 } from '../godot/math/vector';

/** The repeat and offset that sample `region` of a texture of `size` pixels. */
export function regionUvWindow(region: Rect2, size: Vector2): { repeat: Vector2; offset: Vector2 } {
  return {
    repeat: { x: region.w / size.x, y: region.h / size.y },
    offset: { x: region.x / size.x, y: 1 - (region.y + region.h) / size.y },
  };
}
