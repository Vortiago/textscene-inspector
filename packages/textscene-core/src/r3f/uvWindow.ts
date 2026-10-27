/**
 * three's UV window over a texture: the repeat and offset its sampler reads, and the UV edges a
 * quad of its own reads. Godot's image `y` runs top-down and three's `v` runs bottom-up, so a
 * region's bottom edge sets the `v` offset.
 */

import type * as THREE from 'three';
import type { Rect2 } from '../godot/math/rect2';
import type { Vector2 } from '../godot/math/vector';

/** The texture region a quad samples, as three's repeat and offset. */
export interface UvWindow {
  repeat: Vector2;
  offset: Vector2;
}

/** The window over the whole texture. */
export const FULL_UV_WINDOW: Readonly<UvWindow> = Object.freeze({
  repeat: Object.freeze({ x: 1, y: 1 }),
  offset: Object.freeze({ x: 0, y: 0 }),
});

/**
 * The window that samples `region` of a texture of `size` pixels.
 *
 * @canonical A UV window on a texture
 */
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
 *
 * @canonical A UV window on a texture
 */
export function flippedUvWindow({ repeat, offset }: UvWindow, flipH: boolean, flipV: boolean): UvWindow {
  return {
    repeat: { x: flipH ? -repeat.x : repeat.x, y: flipV ? -repeat.y : repeat.y },
    offset: { x: flipH ? offset.x + repeat.x : offset.x, y: flipV ? offset.y + repeat.y : offset.y },
  };
}

/**
 * Points `texture`'s sampler at `window`.
 *
 * @canonical A UV window on a texture
 */
export function applyUvWindow(texture: THREE.Texture, { repeat, offset }: UvWindow): void {
  texture.repeat.set(repeat.x, repeat.y);
  texture.offset.set(offset.x, offset.y);
}

/** The UV edges of a region, for a quad that writes its own UVs. */
export interface UvRect {
  u0: number;
  u1: number;
  vTop: number;
  vBottom: number;
}

/** The UV edges of `region` of a texture of `size` pixels. */
export function regionUvRect(region: Rect2, size: Vector2): UvRect {
  return {
    u0: region.x / size.x,
    u1: (region.x + region.w) / size.x,
    vTop: 1 - region.y / size.y,
    vBottom: 1 - (region.y + region.h) / size.y,
  };
}
