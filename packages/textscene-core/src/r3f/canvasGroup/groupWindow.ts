/** The draw-order keys of a canvas group: which a window collects and which are its owner's own. */

import type { CanvasRunKeys } from '../canvasItemState';

/**
 * The draw-order keys a group collects: its run's `[from, to)` without its own slot, which starts at
 * `own`, the key its rect draws at. A group culls every child before itself
 * (`renderer_canvas_cull.cpp:471-484`).
 */
export type CanvasGroupWindow = CanvasRunKeys;

/**
 * Whether `key` is in the slot of the group's own pixels: its key, and the pieces the item draws
 * after it before the next whole key (`canvasSubOrders`).
 */
export function isOwnKey({ own }: CanvasGroupWindow, key: number): boolean {
  return key >= own && key < own + 1;
}

/** Whether `key` is one of the keys the window collects. */
export function collects(window: CanvasGroupWindow, key: number): boolean {
  return key >= window.from && key < window.to && !isOwnKey(window, key);
}
