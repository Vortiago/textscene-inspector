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
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { ResolvedStyleBox } from '../../../r3f/controls/native/parseStyleBox';
import type { ContainerLayoutFn } from '../../../r3f/controls/native/solverRegistry';
import { contentMarginSize } from '../../../r3f/controls/native/styleBoxFlat';
import { popupPanelDefaultStyle } from '../window/theme';

/** The internal Panel's offsets from the window's edges: the right and bottom ones are zero or less. */
export interface PanelInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const NO_INSETS: PanelInsets = { left: 0, top: 0, right: 0, bottom: 0 };

/** `theme_cache.panel_style`: the `panel` StyleBox, or the default theme's. */
export function popupPanelStyle(n: SolveNode, theme: NativeTheme): ResolvedStyleBox {
  return n.styleBoxes.panel ?? popupPanelDefaultStyle(theme);
}

/**
 * `PopupPanel::_update_shadow_offsets` (`popup.cpp:315-344`) for an embedded, visible popup. Only a
 * `StyleBoxFlat` casts a shadow there, so a line or texture box insets nothing.
 */
export function popupPanelShadowInsets(style: ResolvedStyleBox, rtl: boolean): PanelInsets {
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
 * `PopupPanel::_get_contents_minimum_size` (`popup.cpp:270-292`): the largest child minimum, plus
 * the shadow insets and the panel's own minimum. `childMinimums` are the laid-out children's.
 */
export function popupPanelContentsMinimumSize(
  n: SolveNode,
  childMinimums: readonly Vector2[],
  theme: NativeTheme
): Vector2 {
  const style = popupPanelStyle(n, theme);
  const shadow = insetSize(popupPanelShadowInsets(style, n.rtl));
  const panel = contentMarginSize(style);
  const largest = childMinimums.reduce(
    (max, min) => ({ x: Math.max(max.x, min.x), y: Math.max(max.y, min.y) }),
    {
      x: 0,
      y: 0,
    }
  );
  return { x: largest.x + shadow.x + panel.x, y: largest.y + shadow.y + panel.y };
}

/**
 * `PopupPanel::_update_child_rects` (`popup.cpp:346-368`): every child gets the same rect, the
 * panel's content offset past the shadow inset, sized to the window less both.
 */
export const popupPanelLayout: ContainerLayoutFn = (n, children, rect, ctx) => {
  const style = popupPanelStyle(n, ctx.theme);
  const insets = popupPanelShadowInsets(style, n.rtl);
  const shadow = insetSize(insets);
  const panel = contentMarginSize(style);
  const content: Rect2 = {
    x: style.contentMargin.left + (n.rtl ? -insets.right : insets.left),
    y: style.contentMargin.top + insets.top,
    w: rect.w - panel.x - shadow.x,
    h: rect.h - panel.y - shadow.y,
  };
  return new Map(children.map(({ node }) => [node.path, content]));
};
