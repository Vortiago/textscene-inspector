import { clamp } from '../../../godot/index.js';

/**
 * The scalar arithmetic Godot's noise image layer does, in the integer forms it
 * does it in.
 */

/** `_alpha_blend<uint8_t>` (noise.h:73-79) — integer blend, alpha 0..255. */
export function alphaBlend(background: number, foreground: number, alpha: number): number {
  const a = alpha + 1;
  const inv = 256 - alpha;
  return (a * foreground + inv * background) >> 8;
}

export function clamp8(value: number): number {
  return clamp(Math.trunc(value), 0, 255);
}
