/**
 * The rect a CanvasGroup composites its buffer through, in the canvas's global pixels, as
 * `_attach_canvas_item_for_draw` fits it (`renderer_canvas_cull.cpp:196-256`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { rect2Grow, rect2Merge, rect2Touches, type Rect2 } from '../../../godot/math/rect2';

/**
 * The merge of the drawn item rects that meet `clip`, grown by `fitMargin`. Null when none meets
 * it: Godot lists only an item that meets the clip (`:259`), and a group with an empty list draws
 * nothing (`:206`).
 */
export function compositeRect(drawn: readonly Rect2[], clip: Rect2, fitMargin: number): Rect2 | null {
  const listed = drawn.filter((rect) => rect2Touches(clip, rect));
  if (listed.length === 0) return null;
  const merged = listed.reduce(rect2Merge);
  return rect2Grow(isEmptyRect(merged) ? UNIT_RECT : merged, fitMargin);
}

/** What an all-zero merge becomes before it grows (`:223-225`). */
const UNIT_RECT: Rect2 = { x: 0, y: 0, w: 1, h: 1 };

/** `rect_accum == Rect2()`. */
function isEmptyRect({ x, y, w, h }: Rect2): boolean {
  return x === 0 && y === 0 && w === 0 && h === 0;
}
