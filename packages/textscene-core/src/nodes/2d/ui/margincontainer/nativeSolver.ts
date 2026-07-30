/**
 * MarginContainer's native (WebGL canvas) layout solver — a port of
 * `MarginContainer::get_minimum_size` and its `NOTIFICATION_SORT_CHILDREN`
 * handler (`scene/gui/margin_container.cpp`), plus the shared
 * `Container::fit_child_in_rect` (`scene/gui/container.cpp:95-128`) that
 * handler calls. MarginContainer draws nothing itself — it only insets its
 * children by four theme-constant margins — so this module has no visual
 * counterpart; `NativeComponent.tsx` renders nothing and the walker paints
 * children as siblings.
 *
 * Every child is fit through BOTH axes of `fit_child_in_rect`, always —
 * MarginContainer has no "main axis" the way BoxContainer does (there is no
 * pre-sizing step outside `fit_child_in_rect` for either dimension), so the
 * FILL/SHRINK branch below is symmetric left-right and top-bottom, unlike a
 * box container where one axis is already sized before the fit runs.
 *
 * RTL is out of scope (no `layout_direction` is modelled anywhere in this
 * solver — see `controlRectSolver.ts`), matching `fit_child_in_rect`'s own
 * horizontal-only RTL branches, which this port omits.
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

// Control::SizeFlags (control.h:78-85) — the bits `fit_child_in_rect` tests.

/** `Control`'s own default for an unset `size_flags_horizontal`/`_vertical` (control.h:230-231). */
const DEFAULT_SIZE_FLAGS = SIZE_FILL;

/** `default_theme.cpp:1252-1255` — MarginContainer's four margins default to 0, unscaled. */
const DEFAULT_MARGIN = 0;

function props(n: SolveNode): ControlProperties {
  return n.node.properties as ControlProperties;
}


function marginsOf(n: SolveNode): { left: number; top: number; right: number; bottom: number } {
  const c = props(n).themeOverrideConstants ?? {};
  return {
    left: c.margin_left ?? DEFAULT_MARGIN,
    top: c.margin_top ?? DEFAULT_MARGIN,
    right: c.margin_right ?? DEFAULT_MARGIN,
    bottom: c.margin_bottom ?? DEFAULT_MARGIN,
  };
}


/**
 * `MarginContainer::get_minimum_size` (`margin_container.cpp:35-57`): the
 * componentwise max of every visible child's OWN combined minimum size, plus
 * the four margins. Size flags never enter this computation — only
 * `_notification`'s placement reads them.
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
 * `MarginContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN`
 * (`margin_container.cpp:94-109`): every visible child is fit into the SAME
 * padded content rect (own rect inset by the four margins) — MarginContainer
 * imposes no distribution between multiple children the way a box container
 * does, so several children simply overlap in the padded box.
 */
export const marginContainerLayout: ContainerLayoutFn = (n, children, contentRect, _ctx) => {
  const m = marginsOf(n);
  const w = contentRect.w - m.left - m.right;
  const h = contentRect.h - m.top - m.bottom;
  // Every returned rect is relative to THIS container's own top-left, not its
  // parent's — exactly like `computeAnchoredRect` only ever reads
  // `parentRect.w`/`.h`, never its position. `contentRect.x`/`.y` carry this
  // node's OWN position relative to ITS parent (nonzero once nested), so they
  // must not leak into the offset here or a nested MarginContainer's child
  // would be double-displaced (once by the walker positioning this node's
  // group, again by this line re-adding the same offset).
  const rect: Rect2 = { x: m.left, y: m.top, w, h };

  const out = new Map<string, Rect2>();
  for (const { node: child, minSize } of children) {
    if (!isSortableControl(child)) continue;
    const cp = props(child);
    const hFlags = cp.sizeFlagsHorizontal ?? DEFAULT_SIZE_FLAGS;
    const vFlags = cp.sizeFlagsVertical ?? DEFAULT_SIZE_FLAGS;
    out.set(child.path, fitChildInRect(rect, minSize, hFlags, vFlags));
  }
  return out;
};
