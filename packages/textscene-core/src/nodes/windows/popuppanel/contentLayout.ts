/**
 * PopupPanel's content layout (`scene/gui/popup.cpp:270-368`): its internal Panel fills the window
 * less the room its StyleBoxFlat shadow takes, and every direct Control child that is not
 * `top_level` fills that panel's content rect. Pure functions, no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../godot/math/rect2';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { ResolvedStyleBox } from '../../../r3f/controls/native/parseStyleBox';
import type { ContainerLayoutFn, MinimumSizeFn } from '../../../r3f/controls/native/solverRegistry';
import { everyChildFills, largestLaidOutChildMinimum } from '../window/contentFill';
import { contentMarginSize } from '../../../r3f/controls/native/styleBoxFlat';
import { insetSize, panelRect, shadowInsets, type PanelInsets } from '../window/panelInsets';

/** `theme_cache.panel_style`, the `panel` StyleBox or the default theme's, and its shadow insets. */
export function popupPanelBox(
  n: SolveNode,
  theme: NativeTheme
): { style: ResolvedStyleBox; insets: PanelInsets } {
  const style = n.styleBoxes.panel ?? theme.widgets.popupPanel;
  return { style, insets: shadowInsets(style, n.rtl) };
}

/**
 * `PopupPanel::_get_contents_minimum_size` (`popup.cpp:270-292`): the largest combined minimum of
 * the children its layout places, plus the shadow insets and the panel's own minimum.
 */
export const popupPanelContentsMinimumSize: MinimumSizeFn = (n, ctx) => {
  const { style, insets } = popupPanelBox(n, ctx.theme);
  const shadow = insetSize(insets);
  const panel = contentMarginSize(style);
  const children = largestLaidOutChildMinimum(n, ctx);
  return { x: children.x + shadow.x + panel.x, y: children.y + shadow.y + panel.y };
};

/**
 * `PopupPanel::_update_child_rects` (`popup.cpp:346-368`): every child gets the same rect, the
 * panel's content offset past the shadow inset, sized to the window less both.
 */
export const popupPanelLayout: ContainerLayoutFn = (n, children, rect, ctx) => {
  const { style, insets } = popupPanelBox(n, ctx.theme);
  const box = panelRect(insets, n.rtl, { x: rect.w, y: rect.h });
  const panel = contentMarginSize(style);
  const content: Rect2 = {
    x: box.x + style.contentMargin.left,
    y: box.y + style.contentMargin.top,
    w: box.w - panel.x,
    h: box.h - panel.y,
  };
  return everyChildFills(children, content);
};
