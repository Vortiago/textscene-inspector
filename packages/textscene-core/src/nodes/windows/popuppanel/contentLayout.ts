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

import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { requiredThemeItem } from '../../../r3f/controls/native/themeItems';
import type { ResolvedStyleBox } from '../../../r3f/controls/native/parseStyleBox';
import type { ContainerLayoutFn, MinimumSizeFn } from '../../../r3f/controls/native/solverRegistry';
import { everyChildFills, largestLaidOutChildMinimum } from '../window/contentFill';
import { contentMarginSize, contentRect } from '../../../r3f/controls/native/styleBoxFlat';
import { insetSize, panelRect, shadowInsets, type PanelInsets } from '../window/panelInsets';

/** `theme_cache.panel_style` and its shadow insets. */
export function popupPanelBox(n: SolveNode): { style: ResolvedStyleBox; insets: PanelInsets } {
  const style = requiredThemeItem(n.styleBoxes, 'panel');
  return { style, insets: shadowInsets(style, n.rtl) };
}

/**
 * `PopupPanel::_get_contents_minimum_size` (`popup.cpp:270-292`): the largest combined minimum of
 * the children its layout places, plus the shadow insets and the panel's own minimum.
 */
export const popupPanelContentsMinimumSize: MinimumSizeFn = (n, ctx) => {
  const { style, insets } = popupPanelBox(n);
  const shadow = insetSize(insets);
  const panel = contentMarginSize(style);
  const children = largestLaidOutChildMinimum(n, ctx);
  return { x: children.x + shadow.x + panel.x, y: children.y + shadow.y + panel.y };
};

/**
 * `PopupPanel::_update_child_rects` (`popup.cpp:346-368`): every child gets the same rect, the
 * panel's content offset past the shadow inset, sized to the window less both.
 */
export const popupPanelLayout: ContainerLayoutFn = (n, children, rect) => {
  const { style, insets } = popupPanelBox(n);
  const box = panelRect(insets, n.rtl, { x: rect.w, y: rect.h });
  return everyChildFills(children, contentRect(box, style));
};
