/**
 * A PopupMenu's size and geometry: its contents minimum (`popup_menu.cpp:228-322`), and where its
 * panel, scroll container, item control and scroll bar sit in a window of a given size
 * (`popup_menu.cpp:3483-3493`, `scroll_container.cpp:341-391`). Pure functions, no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rect2 } from '../../../godot/math/rect2';
import type { Vector2 } from '../../../godot/math/vector';
import { ItemCheckableType } from '../../../godot/scene/popupMenu';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { MinimumSizeFn, SolveContext } from '../../../r3f/controls/native/solverRegistry';
import { contentMarginSize } from '../../../r3f/controls/native/styleBoxFlat';
import {
  scrollBarGrabberGeometry,
  scrollBarMinimumSize,
  type ScrollBarPlacement,
} from '../../2d/ui/shared/scrollBarSolver';
import { insetSize, panelRect, shadowInsets } from '../window/panelInsets';
import { gutterWidth, menuItems, minimumCheckSize, type MenuItem } from './menuItems';
import { popupMenuTheme, type PopupMenuTheme } from './menuTheme';

/** The width of the internal ScrollContainer's vertical bar, which the minimum reserves whether or not it shows (`popup_menu.cpp:230`). */
function scrollBarWidth(theme: NativeTheme): number {
  return scrollBarMinimumSize(true, theme).x;
}

/** The widest icon, ignoring whether the item is a separator: the minimum's reading (`popup_menu.cpp:245`). */
function widestIcon(items: readonly MenuItem[]): number {
  return Math.max(0, ...items.map(({ iconSize }) => iconSize.x));
}

/** `_get_items_total_height` (`popup_menu.cpp:255-263`): every item and the gap under it. */
export function itemsTotalHeight(items: readonly MenuItem[], menu: PopupMenuTheme): number {
  return items.reduce((sum, { height }) => sum + height + menu.vSeparation, 0);
}

/**
 * `PopupMenu::_get_contents_minimum_size` (`popup_menu.cpp:228-289`). The check column is always
 * reserved in a compact gutter, and a checkable item with an icon turns the compact gutter off
 * (`:246-250,268-277`). The height is limited to the embedder's and ceiled (`:280-286`).
 */
export const popupMenuContentsMinimumSize: MinimumSizeFn = (n, ctx) => {
  const menu = popupMenuTheme(n, ctx.theme);
  const items = menuItems(n, menu, ctx);
  const margins = contentMarginSize(menu.panel);
  const shadow = insetSize(shadowInsets(menu.panel, n.rtl));

  const checkables = items.filter(({ item }) => item.checkable !== ItemCheckableType.NONE && !item.separator);
  const bodyWidth = Math.max(0, ...items.map(({ textSize }) => textSize.x));
  const hasCheckIcon = checkables.some(({ item }) => item.icon !== undefined);
  const gutter = gutterWidth(
    {
      iconWidth: widestIcon(items),
      checkWidth: minimumCheckSize(n).x,
      hasCheck: checkables.length > 0,
      isCompact: menu.isGutterCompact && !hasCheckIcon,
    },
    menu.hSeparation
  );

  const width =
    margins.x +
    scrollBarWidth(ctx.theme) +
    shadow.x +
    menu.itemStartPadding +
    bodyWidth +
    menu.itemEndPadding +
    gutter;
  const height = margins.y + shadow.y + itemsTotalHeight(items, menu);
  const limit = ctx.embedderSize?.y ?? Number.POSITIVE_INFINITY;
  return { x: width, y: Math.ceil(Math.min(height, limit)) };
};

export interface MenuRow {
  entry: MenuItem;
  /** The item's position in the menu, which names its icon slot. */
  index: number;
  /** The row's top within the item control (`popup_menu.cpp:870-872`). */
  y: number;
}

export interface MenuGeometry {
  panel: Rect2;
  /** The internal ScrollContainer, in window space. */
  scroll: Rect2;
  /** The item control, in window space: the scroll container less the bar it makes room for. */
  control: Rect2;
  /** The vertical bar, relative to the scroll container. */
  verticalBar: ScrollBarPlacement;
  rows: readonly MenuRow[];
}

/** Each row from the first item's half gap, then a whole gap after every item (`popup_menu.cpp:870-872`). */
function menuRows(items: readonly MenuItem[], menu: PopupMenuTheme): MenuRow[] {
  let y = 0;
  return items.map((entry, index) => {
    y += index > 0 ? menu.vSeparation : Math.trunc(menu.vSeparation / 2);
    const row = { entry, index, y };
    y += entry.height;
    return row;
  });
}

/** The vertical bar of the scroll container: it shows when the items are taller than the container (`scroll_container.cpp:592-593`). */
function verticalBar(
  scroll: Rect2,
  contentHeight: number,
  isRtl: boolean,
  theme: NativeTheme
): ScrollBarPlacement {
  const width = scrollBarWidth(theme);
  const rect = { x: isRtl ? 0 : scroll.w - width, y: 0, w: width, h: scroll.h };
  const grabber = scrollBarGrabberGeometry(true, rect.h, theme, 0, contentHeight, rect.h, 0);
  return {
    visible: contentHeight > scroll.h,
    rect,
    grabberRect: { x: 0, y: grabber.offset, w: width, h: grabber.size },
  };
}

/** The geometry of menu `n` in a window of `size`, from the same items its minimum reads. */
export function popupMenuGeometry(n: SolveNode, size: Vector2, ctx: SolveContext): MenuGeometry {
  const menu = popupMenuTheme(n, ctx.theme);
  const items = menuItems(n, menu, ctx);
  const margins = contentMarginSize(menu.panel);

  const panel = panelRect(shadowInsets(menu.panel, n.rtl), n.rtl, size);
  const scroll = {
    x: panel.x + menu.panel.contentMargin.left,
    y: panel.y + menu.panel.contentMargin.top,
    w: panel.w - margins.x,
    h: panel.h - margins.y,
  };
  const contentHeight = itemsTotalHeight(items, menu);
  const bar = verticalBar(scroll, contentHeight, n.rtl, ctx.theme);
  const reserved = bar.visible ? bar.rect.w : 0;
  const control = {
    x: scroll.x + (n.rtl ? reserved : 0),
    y: scroll.y,
    w: scroll.w - reserved,
    h: Math.max(scroll.h, contentHeight),
  };
  return { panel, scroll, control, verticalBar: bar, rows: menuRows(items, menu) };
}
