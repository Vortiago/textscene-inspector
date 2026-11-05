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
import type { Vector2 } from '../../../godot/math/vector';
import { isLaidOutChild, type SolveNode } from '../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { ResolvedStyleBox } from '../../../r3f/controls/native/parseStyleBox';
import type { ContainerLayoutFn, MinimumSizeFn } from '../../../r3f/controls/native/solverRegistry';
import { contentMarginSize } from '../../../r3f/controls/native/styleBoxFlat';

/** The internal Panel's offsets from the window's edges: the right and bottom ones are zero or less. */
interface PanelInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const NO_INSETS: PanelInsets = { left: 0, top: 0, right: 0, bottom: 0 };

/** `theme_cache.panel_style`, the `panel` StyleBox or the default theme's, and its shadow insets. */
export function popupPanelBox(
  n: SolveNode,
  theme: NativeTheme
): { style: ResolvedStyleBox; insets: PanelInsets } {
  const style = n.styleBoxes.panel ?? theme.widgets.popupPanel;
  return { style, insets: popupPanelShadowInsets(style, n.rtl) };
}

/**
 * `PopupPanel::_update_shadow_offsets` (`popup.cpp:315-344`) for an embedded, visible popup. Only a
 * `StyleBoxFlat` casts a shadow there, so a line or texture box insets nothing.
 */
function popupPanelShadowInsets(style: ResolvedStyleBox, rtl: boolean): PanelInsets {
  if ('styleBoxKind' in style || style.shadowSize === 0) return NO_INSETS;
  const size = style.shadowSize;
  const offset = style.shadowOffset;
  const horizontal = rtl ? offset.x : -offset.x;
  return {
    left: Math.max(0, size + horizontal),
    top: Math.max(0, size - offset.y),
    right: Math.min(0, -size + horizontal),
    bottom: Math.min(0, -size - offset.y),
  };
}

/** The space the shadow insets take from the window, per axis. */
function insetSize(insets: PanelInsets): Vector2 {
  return { x: insets.left - insets.right, y: insets.top - insets.bottom };
}

/**
 * The internal Panel's rect in a window of `size`: the window less the shadow insets. A right-to-left
 * layout mirrors it (`control.cpp:1785-1787`).
 */
export function popupPanelRect(insets: PanelInsets, isRtl: boolean, size: Vector2): Rect2 {
  const shadow = insetSize(insets);
  return {
    x: isRtl ? -insets.right : insets.left,
    y: insets.top,
    w: size.x - shadow.x,
    h: size.y - shadow.y,
  };
}

/**
 * `PopupPanel::_get_contents_minimum_size` (`popup.cpp:270-292`): the largest combined minimum of
 * the children its layout places, plus the shadow insets and the panel's own minimum.
 */
export const popupPanelContentsMinimumSize: MinimumSizeFn = (n, ctx) => {
  const { style, insets } = popupPanelBox(n, ctx.theme);
  const shadow = insetSize(insets);
  const panel = contentMarginSize(style);
  let x = 0;
  let y = 0;
  for (const child of n.children) {
    if (!isLaidOutChild(n, child)) continue;
    const childMin = ctx.combinedMinimumSize(child);
    x = Math.max(x, childMin.x);
    y = Math.max(y, childMin.y);
  }
  return { x: x + shadow.x + panel.x, y: y + shadow.y + panel.y };
};

/**
 * `PopupPanel::_update_child_rects` (`popup.cpp:346-368`): every child gets the same rect, the
 * panel's content offset past the shadow inset, sized to the window less both.
 */
export const popupPanelLayout: ContainerLayoutFn = (n, children, rect, ctx) => {
  const { style, insets } = popupPanelBox(n, ctx.theme);
  const box = popupPanelRect(insets, n.rtl, { x: rect.w, y: rect.h });
  const panel = contentMarginSize(style);
  const content: Rect2 = {
    x: box.x + style.contentMargin.left,
    y: box.y + style.contentMargin.top,
    w: box.w - panel.x,
    h: box.h - panel.y,
  };
  return new Map(children.map(({ node }) => [node.path, content]));
};
