/**
 * PanelContainer's native (WebGL canvas) container solve.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 *
 * `panelContainerMinimumSize` ports `PanelContainer::get_minimum_size`
 * (`scene/gui/panel_container.cpp:35-51`): the per-axis MAX of every child's
 * combined minimum size, plus the resolved panel style's own minimum size
 * (`StyleBox::get_minimum_size`, `scene/resources/style_box.cpp:35-36` — the
 * sum of its left+right, top+bottom content margins).
 *
 * `panelContainerLayout` ports `PanelContainer::_notification`'s
 * `NOTIFICATION_SORT_CHILDREN` branch (`panel_container.cpp:78-94`): the
 * content rect is the container's own rect offset by the style's
 * `get_offset()` (its left/top margins) and shrunk by its `get_minimum_size()`
 * (both margin sums) — then every child is fit into that SAME rect via
 * `Container::fit_child_in_rect` (`scene/gui/container.cpp:95-128`), which
 * this module also ports (PanelContainer never overrides it).
 *
 * `contentMargin` on a resolved `StyleBoxFlatData` is already the EFFECTIVE
 * margin (`native/parseStyleBox.ts` has resolved Godot's `-1` "ask the
 * border width" sentinel), so both functions read it directly with no
 * further fallback.
 *
 * Both functions apply `as_sortable_control` (`container.cpp:143-155`,
 * `isSortableControl`) like every other container solver here: a hidden child
 * contributes nothing to the aggregate minimum size, which is what Godot does
 * and is observable — a PanelContainer wrapping one hidden and one visible
 * child must size to the visible one alone. The same helper drops a
 * `top_level` child, which is a canvas root and no child of this container's
 * layout at all.
 *
 * Pure data + functions, no React, no THREE.
 */

import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import { controlProps, type SolveNode } from '../../../../r3f/controls/native/solveTree';
import { contentMarginSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { ContainerLayoutFn, MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { fitChildInRect, isSortableControl, SIZE_FILL } from '../shared/fitChildInRect';


/** The resolved `theme_override_styles/panel`, or the default-theme `panel` struct. */
function panelStyleOf(n: SolveNode, ctx: SolveContext): StyleBoxFlatData {
  return n.styleBoxes.panel ?? ctx.theme.widgets.panel;
}


/**
 * `PanelContainer::get_minimum_size` (`panel_container.cpp:35-51`).
 */
export const panelContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
  let x = 0;
  let y = 0;
  for (const child of n.children) {
    if (!isSortableControl(child)) continue;
    const childMin = ctx.combinedMinimumSize(child);
    x = Math.max(x, childMin.x);
    y = Math.max(y, childMin.y);
  }

  const styleMin = contentMarginSize(panelStyleOf(n, ctx));
  return { x: x + styleMin.x, y: y + styleMin.y };
};

/**
 * `Container::fit_child_in_rect` (`container.cpp:95-128`), the non-RTL branch
 * (this codebase does not model `layout_direction`, matching
 * `controlRectSolver.ts`'s own scope note). `r_p_rect` here is the CONTENT
 * rect `panelContainerLayout` already computed — this function only decides
 * how one child sits inside it.
 */
function fitChild(child: SolveNode, minSize: Vec2, rect: Rect2): Rect2 {
  const props = controlProps(child);
  return fitChildInRect(
    rect,
    minSize,
    props.sizeFlagsHorizontal ?? SIZE_FILL,
    props.sizeFlagsVertical ?? SIZE_FILL
  );
}

/**
 * `PanelContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN` branch
 * (`panel_container.cpp:78-94`). `rect` is the container's OWN solved rect
 * (`controlRectSolver.ts`'s `dispatchChildren` passes it un-inset — insetting
 * for chrome is this function's job, per `solverRegistry.ts`'s
 * `ContainerLayoutFn` contract), so every returned child rect stays relative
 * to the CONTAINER's top-left, not the content rect's.
 */
export const panelContainerLayout: ContainerLayoutFn = (n, children, rect, ctx) => {
  const style = panelStyleOf(n, ctx);
  const { left, top, right, bottom } = style.contentMargin;

  // ofs = style->get_offset() (style_box.cpp:88-89); size -= style->get_minimum_size().
  const contentRect: Rect2 = {
    x: left,
    y: top,
    w: rect.w - left - right,
    h: rect.h - top - bottom,
  };

  const out = new Map<string, Rect2>();
  for (const { node: child, minSize } of children) {
    if (!isSortableControl(child)) continue;
    out.set(child.path, fitChild(child, minSize, contentRect));
  }
  return out;
};
