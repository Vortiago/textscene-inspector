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
import type { CheckBoxIconKey } from '../../2d/ui/checkbox/nativeSolver';
import { ItemCheckableType } from '../../../godot/scene/popupMenu';
import { mirrorX } from '../../../r3f/controls/native/controlRectSolver';
import type { ResolvedStyleBox } from '../../../r3f/controls/native/parseStyleBox';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { contentMarginSize } from '../../../r3f/controls/native/styleBoxFlat';
import type { TextOutlineTheme } from '../../../r3f/controls/native/textTheme';
import type { TextLayoutResult } from '../../../r3f/controls/native/text/textLayout';
import { checkIconKey, checkIconSize, type Gutter, gutterWidth, widestCheckIcon } from './menuItems';
import type { MenuRow } from './menuLayout';
import type { PopupMenuTheme } from './menuTheme';

interface SeparatorLine {
  style: ResolvedStyleBox;
  rect: Rect2;
}

export interface RowDrawing {
  separators: readonly SeparatorLine[];
  /** The check icon and its top-left. */
  check: { key: CheckBoxIconKey; position: Vector2 } | null;
  /** The rect the icon stretches over. */
  icon: { rect: Rect2 } | null;
  text: {
    layout: TextLayoutResult;
    position: Vector2;
    color: Rgba;
    fontSizePx: number;
    /** The theme outline, before the Control's own tint. */
    outline: TextOutlineTheme;
  } | null;
}

/** The gutter as the draw reads it: separators skipped, the widest of all eight check icons (`popup_menu.cpp:870-896`). */
function drawnGutter(rows: readonly MenuRow[], menu: PopupMenuTheme, n: SolveNode): Gutter {
  const items = rows.map(({ entry }) => entry).filter(({ item }) => !item.separator);
  const checkables = items.filter(({ item }) => item.checkable !== ItemCheckableType.NONE);
  return {
    iconWidth: Math.max(0, ...items.map(({ iconSize }) => iconSize.x)),
    checkWidth: checkables.length > 0 ? widestCheckIcon(n) : 0,
    hasCheck: checkables.length > 0,
    isCompact: menu.isGutterCompact && !checkables.some(({ hasIcon }) => hasIcon),
  };
}

/** The top of a `extent` tall part centred in a row at `y` of `height`, with Godot's floor (`popup_menu.cpp:919,926,931`). */
function centredY(y: number, height: number, extent: number): number {
  return y + Math.floor((height - extent) / 2);
}

/** One separator line centred in its row; its height is the style's minimum, which the line box grows itself. */
function separatorLine(
  style: ResolvedStyleBox,
  y: number,
  height: number,
  x: number,
  w: number
): SeparatorLine {
  const lineHeight = Math.trunc(contentMarginSize(style).y);
  return { style, rect: { x, y: centredY(y, height, lineHeight), w: Math.max(0, w), h: lineHeight } };
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
  return [
    ...(left > 0 ? [separatorLine(menu.labeledSeparatorLeft, y, height, 0, left)] : []),
    ...(right < width ? [separatorLine(menu.labeledSeparatorRight, y, height, right, width - right)] : []),
  ];
}

/** Whether a separator has a label or an icon, which turns it into two lines around them. */
function isLabelled(entry: MenuRow['entry']): boolean {
  return entry.item.text.length > 0 || entry.hasIcon;
}

interface RowContext {
  n: SolveNode;
  menu: PopupMenuTheme;
  gutter: Gutter;
  width: number;
}

/** A separator row: its lines, its icon and its label, centred (`popup_menu.cpp:906-1033`). */
function separatorRowDrawing({ n, menu, width }: RowContext, row: MenuRow): RowDrawing {
  const { entry, y } = row;
  const { iconSize, textSize, height } = entry;
  const { hasIcon } = entry;
  if (!isLabelled(entry)) {
    return {
      separators: [separatorLine(menu.separator, y, height, 0, width)],
      check: null,
      icon: null,
      text: null,
    };
  }
  const contentWidth = Math.trunc(
    textSize.x + menu.hSeparation * 2 + (hasIcon ? iconSize.x + menu.hSeparation : 0)
  );
  let textX = Math.trunc((width - textSize.x) / 2);
  let icon: RowDrawing['icon'] = null;
  if (hasIcon) {
    textX = Math.trunc(textX - (iconSize.x + menu.hSeparation) / 2);
    const x = n.rtl ? mirrorX(textX, iconSize.x, width) : textX;
    icon = { rect: { x, y: centredY(y, height, iconSize.y), w: iconSize.x, h: iconSize.y } };
    // The RTL branch leaves the text where the centring put it (`popup_menu.cpp:987-993`).
    if (!n.rtl) textX = Math.trunc(textX + iconSize.x + menu.hSeparation);
  }
  return {
    separators: labelledSeparator(menu, width, y, height, contentWidth),
    check: null,
    icon,
    text: entry.text && {
      layout: entry.text,
      position: { x: textX, y: centredY(y, height, textSize.y) },
      color: menu.fontSeparatorColor,
      fontSizePx: menu.separatorFont.sizePx,
      outline: menu.separatorOutline,
    },
  };
}

/** An item row: its check mark, its icon and its text, mirrored under RTL (`popup_menu.cpp:944-1064`). */
function itemRowDrawing(context: RowContext, row: MenuRow): RowDrawing {
  const { n, menu, gutter, width } = context;
  const { entry, y } = row;
  const { item, iconSize, textSize, height } = entry;
  const startX = menu.itemStartPadding;
  const fromStart = (x: number, extent: number) => (n.rtl ? mirrorX(x, extent, width) : x);

  let check: RowDrawing['check'] = null;
  if (item.checkable !== ItemCheckableType.NONE) {
    const key = checkIconKey(item);
    const size = checkIconSize(n, key);
    check = { key, position: { x: fromStart(startX, size.x), y: centredY(y, height, size.y) } };
  }

  let icon: RowDrawing['icon'] = null;
  if (entry.hasIcon) {
    const checkWidth = gutter.isCompact || !gutter.hasCheck ? 0 : gutter.checkWidth + menu.hSeparation;
    icon = {
      rect: {
        x: fromStart(startX + checkWidth, iconSize.x),
        y: centredY(y, height, iconSize.y),
        w: iconSize.x,
        h: iconSize.y,
      },
    };
  }

  const textY = centredY(y, height, textSize.y);
  return {
    separators: [],
    check,
    icon,
    text: entry.text && {
      layout: entry.text,
      position: {
        x: fromStart(menu.itemStartPadding + gutterWidth(gutter, menu.hSeparation), textSize.x),
        y: textY,
      },
      color: item.disabled ? menu.fontDisabledColor : menu.fontColor,
      fontSizePx: menu.font.sizePx,
      outline: menu.outline,
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
  return rows.map((row) =>
    row.entry.item.separator ? separatorRowDrawing(context, row) : itemRowDrawing(context, row)
  );
}
