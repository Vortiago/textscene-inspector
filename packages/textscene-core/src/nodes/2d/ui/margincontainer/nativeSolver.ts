/**
 * MarginContainer's native layout solver: `MarginContainer::get_minimum_size` and its
 * `NOTIFICATION_SORT_CHILDREN` handler (`scene/gui/margin_container.cpp`), with the shared
 * `Container::fit_child_in_rect` (`scene/gui/container.cpp:95-128`). It fits each child on both axes
 * alike, with no pre-sized main axis. RTL reaches a child only through `fit_child_in_rect`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ControlProperties } from '../control/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { ContainerLayoutFn, MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import { SIZE_FILL, fitChildInRect, isSortableControl } from '../shared/fitChildInRect';

// Control::SizeFlags (control.h:78-85): the bits `fit_child_in_rect` tests.

/** `Control`'s own default for an unset `size_flags_horizontal`/`_vertical` (control.h:230-231). */
const DEFAULT_SIZE_FLAGS = SIZE_FILL;

/** `default_theme.cpp:1252-1255`: MarginContainer's four margins default to 0, unscaled. */
const DEFAULT_MARGIN = 0;

function props(n: SolveNode): ControlProperties {
  return n.node.properties as ControlProperties;
}


function marginsOf(n: SolveNode): { left: number; top: number; right: number; bottom: number } {
  const c = n.constants;
  return {
    left: c.margin_left ?? DEFAULT_MARGIN,
    top: c.margin_top ?? DEFAULT_MARGIN,
    right: c.margin_right ?? DEFAULT_MARGIN,
    bottom: c.margin_bottom ?? DEFAULT_MARGIN,
  };
}


/**
 * `MarginContainer::get_minimum_size` (`margin_container.cpp:35-57`): the componentwise max of each
 * visible child's combined minimum size, plus the four margins. Size flags do not enter it.
 */
export const marginContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
  let maxW = 0;
  let maxH = 0;
  for (const child of n.children) {
    if (!isSortableControl(child)) continue;
    const s = ctx.combinedMinimumSize(child);
    if (s.x > maxW) maxW = s.x;
    if (s.y > maxH) maxH = s.y;
  }
  const m = marginsOf(n);
  return { x: maxW + m.left + m.right, y: maxH + m.top + m.bottom };
};

/**
 * `NOTIFICATION_SORT_CHILDREN` (`margin_container.cpp:94-109`): every visible child fits into the same
 * rect inset by the four margins, so several children overlap.
 */
export const marginContainerLayout: ContainerLayoutFn = (n, children, contentRect, _ctx) => {
  const m = marginsOf(n);
  // `int w`/`int h` (`margin_container.cpp`) narrows the padded result, not the rect.
  const w = Math.trunc(contentRect.w - m.left - m.right);
  const h = Math.trunc(contentRect.h - m.top - m.bottom);
  // Rects are relative to this container's top-left, as `computeAnchoredRect` reads only
  // `parentRect.w`/`.h`. `contentRect.x`/`.y` is this node's position in its parent, and adding it here
  // would displace a nested MarginContainer's child twice.
  const rect: Rect2 = { x: m.left, y: m.top, w, h };

  const out = new Map<string, Rect2>();
  for (const { node: child, minSize } of children) {
    if (!isSortableControl(child)) continue;
    const cp = props(child);
    const hFlags = cp.sizeFlagsHorizontal ?? DEFAULT_SIZE_FLAGS;
    const vFlags = cp.sizeFlagsVertical ?? DEFAULT_SIZE_FLAGS;
    out.set(child.path, fitChildInRect(rect, minSize, hFlags, vFlags, n.rtl));
  }
  return out;
};
