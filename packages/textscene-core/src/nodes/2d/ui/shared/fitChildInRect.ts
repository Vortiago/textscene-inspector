/**
 * `Container::fit_child_in_rect` (`scene/gui/container.cpp:95-128`) and the SizeFlags bitmask it
 * reads. It is a method on `Container` that every container calls after its own arrangement, so it
 * lives here once: a fix would otherwise have to land in every container slice.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import { isTopLevelItem } from '../../../../r3f/canvasPaintOrder';
import { isPromotedControl, type SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { ControlProperties } from '../control/types';

/** `Control::SizeFlags` (`scene/gui/control.h:64-69`). */
export const SIZE_FILL = 1;
export const SIZE_EXPAND = 2;
export const SIZE_SHRINK_CENTER = 4;
export const SIZE_SHRINK_END = 8;

export const hasFlag = (flags: number, bit: number): boolean => (flags & bit) !== 0;

/**
 * Places a child in the rect its container assigned. `SIZE_FILL` short-circuits the shrink branch
 * (`if (!flags.has_flag(SIZE_FILL))`), so `FILL|SHRINK_CENTER` (5) stretches. Without FILL or SHRINK
 * the child shrinks to its minimum at the begin edge. It runs on both axes, so an `EXPAND` child
 * without `FILL` has its reserved main-axis space clawed back to its minimum here.
 */
export function fitChildInRect(
  rect: Rect2,
  minSize: Vec2,
  hFlags: number,
  vFlags: number,
  rtl: boolean
): Rect2 {
  // `rtl` is the container's `is_layout_rtl()` (`SolveNode.rtl`), read inside this function to
  // mirror the horizontal edges. It has no default: one would claim the caller is never RTL, which
  // `CenterContainer` (cell equal to the child's minimum) met only by accident.
  let { x, y, w, h } = rect;

  if (!hasFlag(hFlags, SIZE_FILL)) {
    w = minSize.x;
    if (hasFlag(hFlags, SIZE_SHRINK_END)) {
      x += rtl ? 0 : rect.w - minSize.x;
    } else if (hasFlag(hFlags, SIZE_SHRINK_CENTER)) {
      x += Math.floor((rect.w - minSize.x) / 2);
    } else {
      x += rtl ? rect.w - minSize.x : 0;
    }
  }

  if (!hasFlag(vFlags, SIZE_FILL)) {
    h = minSize.y;
    if (hasFlag(vFlags, SIZE_SHRINK_END)) {
      y += rect.h - minSize.y;
    } else if (hasFlag(vFlags, SIZE_SHRINK_CENTER)) {
      y += Math.floor((rect.h - minSize.y) / 2);
    }
    // SHRINK_BEGIN (no bit set): no vertical offset, matching the C++'s empty branch.
  }

  return { x, y, w, h };
}

/**
 * Whether a container counts this child: `Container::as_sortable_control` skips an invisible
 * child's slot. Its default `VISIBLE` mode tests `!c->is_visible()` (`container.cpp:148-150`), so
 * `SolveNode.parentVisibleInTree` stays out, and `hidden` (the editor eye toggle) acts as a cleared `visible`.
 */
export function isSortableControl(node: SolveNode): boolean {
  // A promoted child is a grandchild that `get_child(i)` never yields. A `top_level` one fails
  // `if (!c || c->is_set_as_top_level())` ahead of every visibility mode (`container.cpp:144-146`),
  // so even the `IGNORE` mode that keeps a hidden TabContainer page drops it.
  if (isPromotedControl(node)) return false;
  if (isTopLevelItem(node.node)) return false;
  return !node.hidden && (node.node.properties as ControlProperties).visible !== false;
}
