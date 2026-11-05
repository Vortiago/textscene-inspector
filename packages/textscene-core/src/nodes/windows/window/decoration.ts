/**
 * Where an embedder draws a window's title and close icon around its rect, as
 * `Viewport::_sub_window_update` places them (`scene/main/viewport.cpp:342-401`). Every input is the
 * window's own theme item, so the painter and its tests read one formula.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../godot/math/rect2';
import type { Vector2 } from '../../../godot/math/vector';

/** The width a title may take: what the border's margins and the close offset leave (`:363`). */
export function titleSpace(
  width: number,
  { borderMinimumWidth, closeHOffset }: { borderMinimumWidth: number; closeHOffset: number }
): number {
  return Math.max(0, width - borderMinimumWidth - closeHOffset);
}

/**
 * The top-left of the title line: centred over the window, and centred in the `title_height` band
 * above it (`:368-369`). Both halves land in an `int`, which truncates toward zero.
 */
export function titleOrigin(rect: Rect2, titleHeight: number, textSize: Vector2): Vector2 {
  return {
    x: rect.x + (Math.trunc((rect.w - textSize.x) / 2) || 0),
    y: rect.y + (Math.trunc((-titleHeight - textSize.y) / 2) || 0),
  };
}

/** The top-left of the close icon, hung from the window's top-right corner (`:382-384`). */
export function closeIconOrigin(
  rect: Rect2,
  { closeHOffset, closeVOffset }: { closeHOffset: number; closeVOffset: number }
): Vector2 {
  return { x: rect.x + rect.w - closeHOffset, y: rect.y - closeVOffset };
}
