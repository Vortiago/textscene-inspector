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
import type {
  LoadedMinimumSizeFn,
  MinimumSizeFn,
  SolveContext,
} from '../../../r3f/controls/native/solverRegistry';
import { contentMarginSize, contentRect } from '../../../r3f/controls/native/styleBoxFlat';
import {
  scrollBarPlacement,
  scrollBarMinimumSize,
  type ScrollBarPlacement,
} from '../../2d/ui/shared/scrollBarSolver';
import { insetSize, panelRect, shadowInsets } from '../window/panelInsets';
import { gutterWidth, menuItems, minimumCheckSize, type MenuItem } from './menuItems';
import { perObject } from '../../../utils/perObject';
import { popupMenuTheme, type PopupMenuTheme } from './menuTheme';
import type { PopupMenuItem, PopupMenuProperties } from './types';

/** The width of the internal ScrollContainer's vertical bar, which the minimum reserves whether or not it shows (`popup_menu.cpp:230`). */
function scrollBarWidth(theme: NativeTheme): number {
  return scrollBarMinimumSize(true, theme).x;
}

/** The widest icon, ignoring whether the item is a separator: the minimum's reading (`popup_menu.cpp:245`). */
function widestIcon(items: readonly MenuItem[]): number {
  return Math.max(0, ...items.map(({ iconSize }) => iconSize.x));
}

/** What a PopupMenu's size and geometry both read: its theme items and its measured items. */
export interface MenuModel {
  theme: NativeTheme;
  menu: PopupMenuTheme;
  items: readonly MenuItem[];
}

/**
 * Written only by {@link menuModel}. A node keeps the model of its last theme and measurer.
 */
// eslint-disable-next-line no-restricted-syntax -- perObject keys on one object, and this model also depends on the theme and the measurer.
const modelOfNode = new WeakMap<
  SolveNode,
  { ctx: Pick<SolveContext, 'theme' | 'measureText'>; model: MenuModel }
>();

function buildMenuModel(
  n: SolveNode,
  ctx: Pick<SolveContext, 'theme' | 'measureText'>,
  items: readonly PopupMenuItem[]
): MenuModel {
  const menu = popupMenuTheme(n, ctx.theme);
  return { theme: ctx.theme, menu, items: menuItems(n, menu, ctx, items) };
}

/**
 * The model of the scene's own items. Shaping each label is the heaviest work of a menu, and the minimum
 * and the chrome both read the model, so one node shapes once per theme and measurer.
 */
export function menuModel(n: SolveNode, ctx: Pick<SolveContext, 'theme' | 'measureText'>): MenuModel {
  const cached = modelOfNode.get(n);
  if (cached && cached.ctx.theme === ctx.theme && cached.ctx.measureText === ctx.measureText)
    return cached.model;
  const model = buildMenuModel(n, ctx, (n.node.properties as PopupMenuProperties).items);
  modelOfNode.set(n, { ctx: { theme: ctx.theme, measureText: ctx.measureText }, model });
  return model;
}

/** `_get_items_total_height` (`popup_menu.cpp:255-263`): every item and the gap under it. */
function itemsTotalHeight(items: readonly MenuItem[], menu: PopupMenuTheme): number {
  return items.reduce((sum, { height }) => sum + height + menu.vSeparation, 0);
}

/**
 * `PopupMenu::_get_contents_minimum_size` (`popup_menu.cpp:228-289`). The check column is always
 * reserved in a compact gutter, and a checkable item with an icon turns the compact gutter off
 * (`:246-250,268-277`). The height is limited to the embedder's and ceiled (`:280-286`).
 */
function contentsMinimumSize(n: SolveNode, ctx: SolveContext, model: MenuModel, limit: number): Vector2 {
  const { menu, items } = model;
  const margins = contentMarginSize(menu.panel);
  const shadow = insetSize(shadowInsets(menu.panel, n.rtl));

  const checkables = items.filter(({ item }) => item.checkable !== ItemCheckableType.NONE && !item.separator);
  const bodyWidth = Math.max(0, ...items.map(({ textSize }) => textSize.x));
  const hasCheckIcon = checkables.some(({ hasIcon }) => hasIcon);
  const gutter = gutterWidth(
    {
      iconWidth: widestIcon(items),
      checkWidth: minimumCheckSize(menu).x,
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
  return { x: width, y: Math.ceil(Math.min(height, limit)) };
}

export const popupMenuContentsMinimumSize: MinimumSizeFn = (n, ctx) =>
  contentsMinimumSize(n, ctx, menuModel(n, ctx), ctx.embedderSize?.y ?? Number.POSITIVE_INFINITY);

/** The minimum of the items set when the `size` line is applied: the menu is not in the tree, so nothing limits its height. */
export const popupMenuLoadedMinimumSize: LoadedMinimumSizeFn = (n, ctx) => {
  const { items, itemsAtSize } = n.node.properties as PopupMenuProperties;
  if (!itemsAtSize) return null;
  const model = itemsAtSize === items ? menuModel(n, ctx) : buildMenuModel(n, ctx, itemsAtSize);
  return contentsMinimumSize(n, ctx, model, Number.POSITIVE_INFINITY);
};

export interface MenuRow {
  entry: MenuItem;
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

/**
 * Whether a row is inside the scroll container at the scroll offset 0 a still frame has. A row
 * below it is clipped away whole, so a menu of any length draws only the rows it shows.
 */
export function isRowInView(row: MenuRow, viewHeight: number): boolean {
  return row.y < viewHeight;
}

/**
 * Each row from the first item's half gap, then a whole gap after every item (`popup_menu.cpp:870-872`).
 * The rows depend on the model alone, so the same array returns until the model changes and a row
 * drawing keyed on it survives a resize.
 */
const menuRows = perObject(({ items, menu }: MenuModel): readonly MenuRow[] => {
  let y = 0;
  return items.map((entry, index) => {
    y += index > 0 ? menu.vSeparation : Math.trunc(menu.vSeparation / 2);
    const row = { entry, y };
    y += entry.height;
    return row;
  });
});

/** The vertical bar of the scroll container: it shows when the items are taller than the container (`scroll_container.cpp:592-593`). */
function verticalBar(
  scroll: Rect2,
  contentHeight: number,
  isRtl: boolean,
  theme: NativeTheme
): ScrollBarPlacement {
  const width = scrollBarWidth(theme);
  const rect = { x: isRtl ? 0 : scroll.w - width, y: 0, w: width, h: scroll.h };
  return scrollBarPlacement(true, rect, theme, contentHeight, 0, contentHeight > scroll.h);
}

/** The geometry of menu `n` in a window of `size`, from the same items its minimum reads. */
export function popupMenuGeometry(n: SolveNode, size: Vector2, model: MenuModel): MenuGeometry {
  const { theme, menu, items } = model;
  const panel = panelRect(shadowInsets(menu.panel, n.rtl), n.rtl, size);
  const scroll = contentRect(panel, menu.panel);
  const contentHeight = itemsTotalHeight(items, menu);
  const bar = verticalBar(scroll, contentHeight, n.rtl, theme);
  const reserved = bar.visible ? bar.rect.w : 0;
  const control = {
    x: scroll.x + (n.rtl ? reserved : 0),
    y: scroll.y,
    w: scroll.w - reserved,
    h: Math.max(scroll.h, contentHeight),
  };
  return { panel, scroll, control, verticalBar: bar, rows: menuRows(model) };
}
