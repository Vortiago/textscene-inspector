/**
 * Where `PopupMenu::_draw_items` puts each part of each row (`popup_menu.cpp:847-1085`), in the item
 * control's own space: the separator lines, the check mark, the icon and the text. Pure: no React,
 * no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rgba } from '../../../godot/math/math';
import type { Rect2 } from '../../../godot/math/rect2';
import type { Vector2 } from '../../../godot/math/vector';
import { ItemCheckableType } from '../../../godot/scene/popupMenu';
import type { ResolvedStyleBox } from '../../../r3f/controls/native/parseStyleBox';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { contentMarginSize } from '../../../r3f/controls/native/styleBoxFlat';
import type { TextLayoutResult } from '../../../r3f/controls/native/text/textLayout';
import {
  checkIconKey,
  checkIconSize,
  type CheckIconKey,
  menuItemIconSlot,
  widestCheckIcon,
} from './menuItems';
import type { MenuRow } from './menuLayout';
import type { PopupMenuTheme } from './menuTheme';

interface SeparatorLine {
  style: ResolvedStyleBox;
  rect: Rect2;
}

export interface RowDrawing {
  separators: readonly SeparatorLine[];
  /** The check icon and its top-left. */
  check: { key: CheckIconKey; position: Vector2 } | null;
  /** The texture slot and the rect the icon stretches over. */
  icon: { slot: string; rect: Rect2 } | null;
  text: { layout: TextLayoutResult; position: Vector2; color: Rgba } | null;
}

/** What the gutter reads from every row before any is drawn (`popup_menu.cpp:870-896`). */
interface Gutter {
  iconWidth: number;
  checkWidth: number;
  hasCheck: boolean;
  isCompact: boolean;
}

function drawnGutter(rows: readonly MenuRow[], menu: PopupMenuTheme, n: SolveNode): Gutter {
  const items = rows.map(({ entry }) => entry).filter(({ item }) => !item.separator);
  const checkables = items.filter(({ item }) => item.checkable !== ItemCheckableType.NONE);
  return {
    iconWidth: Math.max(0, ...items.map(({ iconSize }) => iconSize.x)),
    checkWidth: checkables.length > 0 ? widestCheckIcon(n) : 0,
    hasCheck: checkables.length > 0,
    isCompact: menu.isGutterCompact && !checkables.some(({ item }) => item.icon !== undefined),
  };
}

/** The line a separator without content draws, across the whole row (`popup_menu.cpp:928-932`). */
function plainSeparator(menu: PopupMenuTheme, width: number, y: number, height: number): SeparatorLine[] {
  const lineHeight = Math.trunc(contentMarginSize(menu.separator).y);
  const top = y + Math.floor((height - lineHeight) / 2);
  return [{ style: menu.separator, rect: { x: 0, y: top, w: width, h: lineHeight } }];
}

/** The two lines either side of a labelled separator's content, with `int` arithmetic throughout (`popup_menu.cpp:908-927`). */
function labelledSeparator(
  menu: PopupMenuTheme,
  width: number,
  y: number,
  height: number,
  contentWidth: number
): SeparatorLine[] {
  const center = Math.trunc(width / 2);
  const left = center - Math.trunc(contentWidth / 2);
  const right = center + Math.trunc(contentWidth / 2);
  const line = (style: ResolvedStyleBox, x: number, w: number) => {
    const lineHeight = Math.trunc(contentMarginSize(style).y);
    return {
      style,
      rect: { x, y: y + Math.floor((height - lineHeight) / 2), w: Math.max(0, w), h: lineHeight },
    };
  };
  return [
    ...(left > 0 ? [line(menu.labeledSeparatorLeft, 0, left)] : []),
    ...(right < width ? [line(menu.labeledSeparatorRight, right, width - right)] : []),
  ];
}

/** Whether a separator has a label or an icon, which turns it into two lines around them. */
function isLabelled(entry: MenuRow['entry']): boolean {
  return entry.item.text.length > 0 || entry.item.icon !== undefined;
}

interface RowContext {
  n: SolveNode;
  menu: PopupMenuTheme;
  gutter: Gutter;
  width: number;
}

/** A separator row: its lines, its icon and its label, centred (`popup_menu.cpp:906-1033`). */
function separatorRowDrawing({ n, menu, width }: RowContext, row: MenuRow, index: number): RowDrawing {
  const { entry, y } = row;
  const { iconSize, textSize, height } = entry;
  const hasIcon = entry.item.icon !== undefined;
  if (!isLabelled(entry)) {
    return { separators: plainSeparator(menu, width, y, height), check: null, icon: null, text: null };
  }
  const contentWidth = Math.trunc(
    textSize.x + menu.hSeparation * 2 + (hasIcon ? iconSize.x + menu.hSeparation : 0)
  );
  let textX = Math.trunc((width - textSize.x) / 2);
  let icon: RowDrawing['icon'] = null;
  if (hasIcon) {
    textX = Math.trunc(textX - (iconSize.x + menu.hSeparation) / 2);
    const x = n.rtl ? width - textX - iconSize.x : textX;
    icon = {
      slot: menuItemIconSlot(index),
      rect: { x, y: y + Math.floor((height - iconSize.y) / 2), w: iconSize.x, h: iconSize.y },
    };
    // The RTL branch leaves the text where the centring put it (`popup_menu.cpp:987-993`).
    if (!n.rtl) textX = Math.trunc(textX + iconSize.x + menu.hSeparation);
  }
  return {
    separators: labelledSeparator(menu, width, y, height, contentWidth),
    check: null,
    icon,
    text: entry.text && {
      layout: entry.text,
      position: { x: textX, y: y + Math.floor((height - textSize.y) / 2) },
      color: menu.fontSeparatorColor,
    },
  };
}

/** The x the text starts at, after the start padding and the gutter (`popup_menu.cpp:1043-1056`). */
function textStart({ menu, gutter }: RowContext): number {
  if (gutter.isCompact)
    return menu.itemStartPadding + Math.max(gutter.iconWidth, gutter.checkWidth) + menu.hSeparation;
  const icon = gutter.iconWidth > 0 ? gutter.iconWidth + menu.hSeparation : 0;
  const check = gutter.hasCheck ? gutter.checkWidth + menu.hSeparation : 0;
  return menu.itemStartPadding + icon + check;
}

/** An item row: its check mark, its icon and its text, mirrored under RTL (`popup_menu.cpp:944-1064`). */
function itemRowDrawing(context: RowContext, row: MenuRow, index: number): RowDrawing {
  const { n, menu, gutter, width } = context;
  const { entry, y } = row;
  const { item, iconSize, textSize, height } = entry;
  const startX = menu.itemStartPadding;
  const fromStart = (x: number, extent: number) => (n.rtl ? width - x - extent : x);

  let check: RowDrawing['check'] = null;
  if (item.checkable !== ItemCheckableType.NONE) {
    const key = checkIconKey(item);
    const size = checkIconSize(n, key);
    check = { key, position: { x: fromStart(startX, size.x), y: y + Math.floor((height - size.y) / 2) } };
  }

  let icon: RowDrawing['icon'] = null;
  if (item.icon !== undefined) {
    const checkWidth = gutter.isCompact || !gutter.hasCheck ? 0 : gutter.checkWidth + menu.hSeparation;
    icon = {
      slot: menuItemIconSlot(index),
      rect: {
        x: fromStart(startX + checkWidth, iconSize.x),
        y: y + Math.floor((height - iconSize.y) / 2),
        w: iconSize.x,
        h: iconSize.y,
      },
    };
  }

  const textY = y + Math.floor((height - textSize.y) / 2);
  return {
    separators: [],
    check,
    icon,
    text: entry.text && {
      layout: entry.text,
      position: { x: fromStart(textStart(context), textSize.x), y: textY },
      color: item.disabled ? menu.fontDisabledColor : menu.fontColor,
    },
  };
}

/** Every row of the menu as `_draw_items` draws it, for an item control `width` wide. */
export function popupMenuDrawing(
  n: SolveNode,
  menu: PopupMenuTheme,
  rows: readonly MenuRow[],
  width: number
): readonly RowDrawing[] {
  const context = { n, menu, gutter: drawnGutter(rows, menu, n), width };
  return rows.map((row, index) =>
    row.entry.item.separator ? separatorRowDrawing(context, row, index) : itemRowDrawing(context, row, index)
  );
}
