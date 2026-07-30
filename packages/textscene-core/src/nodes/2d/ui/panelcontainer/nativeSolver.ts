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
 * Neither function models `as_sortable_control`'s `top_level`/visibility
 * filter (`container.cpp:143-155`): `top_level` Controls are not modelled
 * anywhere in this codebase's solve tree, and no other registered
 * `MinimumSizeFn`/`ContainerLayoutFn` filters by visibility either — a
 * hidden child's own group is hidden at paint time by `ControlCanvasWalker`
 * regardless of the rect this solve gives it.
 *
 * Pure data + functions, no React, no THREE.
 */

import type { ControlProperties } from '../control/types';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { ContainerLayoutFn, MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';

/** `Control::SizeFlags` (`scene/gui/control.h:78-85`). */
const SIZE_FILL = 1;
const SIZE_SHRINK_CENTER = 4;
const SIZE_SHRINK_END = 8;

function controlProps(n: SolveNode): ControlProperties {
  return n.node.properties as ControlProperties;
}

/** The resolved `theme_override_styles/panel`, or the default-theme `panel` struct. */
function panelStyleOf(n: SolveNode, ctx: SolveContext): StyleBoxFlatData {
  return n.styleBoxes.panel ?? ctx.theme.widgets.panel;
}

/** `StyleBox::get_minimum_size` (`style_box.cpp:35-36`): margin-left+right, margin-top+bottom. */
function styleMinimumSize(style: StyleBoxFlatData): Vec2 {
  return {
    x: style.contentMargin.left + style.contentMargin.right,
    y: style.contentMargin.top + style.contentMargin.bottom,
  };
}

/**
 * `PanelContainer::get_minimum_size` (`panel_container.cpp:35-51`).
 */
export const panelContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
  let x = 0;
  let y = 0;
  for (const child of n.children) {
    const childMin = ctx.combinedMinimumSize(child);
    x = Math.max(x, childMin.x);
    y = Math.max(y, childMin.y);
  }

  const styleMin = styleMinimumSize(panelStyleOf(n, ctx));
  return { x: x + styleMin.x, y: y + styleMin.y };
};

/**
 * `Container::fit_child_in_rect` (`container.cpp:95-128`), the non-RTL branch
 * (this codebase does not model `layout_direction`, matching
 * `controlRectSolver.ts`'s own scope note). `r_p_rect` here is the CONTENT
 * rect `panelContainerLayout` already computed — this function only decides
 * how one child sits inside it.
 */
function fitChildInRect(child: SolveNode, minSize: Vec2, rect: Rect2): Rect2 {
  const props = controlProps(child);
  const hFlags = props.sizeFlagsHorizontal ?? SIZE_FILL;
  const vFlags = props.sizeFlagsVertical ?? SIZE_FILL;

  let { x, y, w, h } = rect;

  if ((hFlags & SIZE_FILL) === 0) {
    w = minSize.x;
    if ((hFlags & SIZE_SHRINK_END) !== 0) {
      x += rect.w - minSize.x;
    } else if ((hFlags & SIZE_SHRINK_CENTER) !== 0) {
      x += Math.floor((rect.w - minSize.x) / 2);
    }
    // SHRINK_BEGIN (no bit set): x unchanged.
  }

  if ((vFlags & SIZE_FILL) === 0) {
    h = minSize.y;
    if ((vFlags & SIZE_SHRINK_END) !== 0) {
      y += rect.h - minSize.y;
    } else if ((vFlags & SIZE_SHRINK_CENTER) !== 0) {
      y += Math.floor((rect.h - minSize.y) / 2);
    }
  }

  return { x, y, w, h };
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
    out.set(child.path, fitChildInRect(child, minSize, contentRect));
  }
  return out;
};
