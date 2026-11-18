import type { Rect2 } from '../../godot/math/rect2.js';
import type { Vector2 } from '../../godot/math/vector.js';
import type { RootWindow } from './rootWindow.js';

/**
 * Where the root target lands in a pane of `pane` pixels, as a WebGL viewport from the bottom-left.
 * The window fills the pane at one scale, centred, and the pane is never the window's size.
 */
export function targetRectInPane(pane: Vector2, window: Pick<RootWindow, 'size' | 'drawRect'>): Rect2 {
  const scale = Math.min(pane.x / window.size.x, pane.y / window.size.y);
  const left = (pane.x - window.size.x * scale) / 2;
  const top = (pane.y - window.size.y * scale) / 2;
  const { x, y, w, h } = window.drawRect;
  return { x: left + x * scale, y: pane.y - top - (y + h) * scale, w: w * scale, h: h * scale };
}
