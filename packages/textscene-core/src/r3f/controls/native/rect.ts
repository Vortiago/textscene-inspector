/**
 * Plain 2D geometry for the native Control rect solve, in Godot pixels with +Y
 * down like `World2DCanvas.tsx`. The walker, not this module, flips a solved
 * `Rect2` to a three.js position (`[rect.x, -rect.y, 0]`). Pure data: no React, no THREE.
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** A Control's rect in Godot pixels, +Y down. */
export interface Rect2 {
  x: number;
  y: number;
  w: number;
  h: number;
}
