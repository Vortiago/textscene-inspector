/**
 * `Container::fit_child_in_rect` (`scene/gui/container.cpp:95-128`) and the
 * SizeFlags bitmask it reads — shared because Godot shares it: it is a method on
 * `Container` itself, not on any subclass, and every container type funnels
 * through it after computing its own arrangement.
 *
 * Kept in one place deliberately. Each container's *arrangement* pass is
 * genuinely type-specific and belongs in its own slice, but this final
 * shrink/position step is identical for all of them — so a fix here (RTL
 * arriving, an off-by-one in the shrink maths) would otherwise have to be found
 * and applied in five slices in lockstep, and missing one is invisible until a
 * scene exercises exactly that container with exactly that flag.
 *
 * Framework-free: plain data in, plain data out.
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
 * Places a child inside the rect its container assigned it.
 *
 * `SIZE_FILL` short-circuits: the shrink branch runs only inside
 * `if (!flags.has_flag(SIZE_FILL))`, so a flag like `FILL|SHRINK_CENTER` (5)
 * stretches and the shrink bit is never read. Without any FILL or SHRINK bit the
 * child shrinks to its minimum at the begin edge — the C++'s empty else branch.
 *
 * Runs on BOTH axes unconditionally. It only *looks* cross-axis-only in the box
 * containers because their `_resort` has already sized the main axis to the
 * child's minimum when the child does not stretch — so a child with `EXPAND` but
 * no `FILL` has its reserved space clawed back to its minimum here.
 *
 * `rtl` mirrors the horizontal begin/end edges (`layout_direction`). Only the box
 * containers thread it today; the rest pass the default.
 */
export function fitChildInRect(
  rect: Rect2,
  minSize: Vec2,
  hFlags: number,
  vFlags: number,
  rtl = false
): Rect2 {
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
 * Whether a container counts this child when arranging — `Container::as_sortable_control`
 * skips an invisible child's slot entirely rather than laying out an empty one.
 *
 * Approximates Godot's `is_visible_in_tree()` with this node's own `visible`
 * flag: a `SolveNode` carries no parent pointer, and an invisible ancestor's
 * whole subtree is skipped upstream anyway, so the two agree in practice.
 *
 * `hidden` is the scene-tree eye toggle, which stands in for clearing `visible`
 * in the editor and so has to reach the same rule.
 *
 * A promoted child fails the cast itself rather than the visibility check: it
 * is a grandchild in the real tree, so `get_child(i)` never yields it. So does
 * a `top_level` one — `if (!c || c->is_set_as_top_level())` runs ahead of every
 * visibility mode (`container.cpp:144-146`), so even the `IGNORE` mode that
 * keeps a hidden TabContainer page drops it.
 */
export function isSortableControl(node: SolveNode): boolean {
  if (isPromotedControl(node)) return false;
  if (isTopLevelItem(node.node)) return false;
  return !node.hidden && (node.node.properties as ControlProperties).visible !== false;
}
