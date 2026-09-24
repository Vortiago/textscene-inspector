/**
 * PanelContainer's native (WebGL canvas) container solve, from
 * `scene/gui/panel_container.cpp:35-51` and `:78-94`: pure functions, no
 * React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 *
 * Both functions skip a child that fails `as_sortable_control`
 * (`container.cpp:143-155`): a hidden child adds nothing to the minimum size,
 * and a `top_level` child is a canvas root outside this layout.
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
 * `PanelContainer::get_minimum_size` (`panel_container.cpp:35-51`): the
 * per-axis max of the children's minimum sizes, plus the panel style's margin
 * sums (`StyleBox::get_minimum_size`, `scene/resources/style_box.cpp:35-36`).
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
 * `Container::fit_child_in_rect` (`scene/gui/container.cpp:95-128`) inside the
 * content rect. `panel_container.cpp` has no RTL branch, and
 * `container.cpp:95-128` reads the container's flag, never the child's.
 */
function fitChild(child: SolveNode, minSize: Vec2, rect: Rect2, rtl: boolean): Rect2 {
  const props = controlProps(child);
  return fitChildInRect(
    rect,
    minSize,
    props.sizeFlagsHorizontal ?? SIZE_FILL,
    props.sizeFlagsVertical ?? SIZE_FILL,
    rtl
  );
}

/**
 * `PanelContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN` branch
 * (`panel_container.cpp:78-94`): every child fits the same content rect.
 * `rect` arrives un-inset, so each child rect is relative to the container's
 * top-left, not the content rect's.
 */
export const panelContainerLayout: ContainerLayoutFn = (n, children, rect, ctx) => {
  const style = panelStyleOf(n, ctx);
  // `contentMargin` is already the effective margin: `native/parseStyleBox.ts`
  // resolves Godot's `-1` "ask the border width" sentinel.
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
    out.set(child.path, fitChild(child, minSize, contentRect, n.rtl));
  }
  return out;
};
