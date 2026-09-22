/**
 * Plain 2D geometry for the native Control rect solve. Godot
 * pixels throughout, +Y down — the same convention the 2D world canvas
 * already uses (`World2DCanvas.tsx`), so a solved `Rect2` needs no axis flip
 * until a component converts it to a three.js position (`[rect.x, -rect.y,
 * 0]`, done by the walker, not here).
 *
 * Pure data, no React, no THREE — every other `native/` module builds on
 * these two shapes.
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
