/**
 * three's UV window over a texture: the repeat and offset its sampler reads. Godot's image `y` runs
 * top-down and three's `v` runs bottom-up, so a region's bottom edge sets the `v` offset.
 */

import type { Rect2 } from '../godot/math/rect2';
import type { Vector2 } from '../godot/math/vector';

/** The texture region a quad samples, as three's repeat and offset. */
export interface UvWindow {
  repeat: Vector2;
  offset: Vector2;
}

/** The window that samples `region` of a texture of `size` pixels. */
export function regionUvWindow(region: Rect2, size: Vector2): UvWindow {
  return {
    repeat: { x: region.w / size.x, y: region.h / size.y },
    offset: { x: region.x / size.x, y: 1 - (region.y + region.h) / size.y },
  };
}

/**
 * `window` swept from its far edge on each flipped axis (`offset + repeat`, `-repeat`), as Godot
 * mirrors the drawn quad. three has no negative-size quad. Under `RepeatWrapping`, GLSL's floor-mod
 * `fract()` lands on Godot's `(rectSize - x) mod textureSize`.
 */
export function flippedUvWindow({ repeat, offset }: UvWindow, flipH: boolean, flipV: boolean): UvWindow {
  return {
    repeat: { x: flipH ? -repeat.x : repeat.x, y: flipV ? -repeat.y : repeat.y },
    offset: { x: flipH ? offset.x + repeat.x : offset.x, y: flipV ? offset.y + repeat.y : offset.y },
  };
}
