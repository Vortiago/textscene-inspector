/**
 * What a PopupMenu knows of each item before it places any: its shaped text, its icon size and its
 * height (`popup_menu.cpp:189-227,983-1002`), and the check icons every item shares. Pure: no React,
 * no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Vector2 } from '../../../godot/math/vector';
import { ItemCheckableType } from '../../../godot/scene/popupMenu';
import { TextDirection } from '../../../godot/text/textServerEnums';
import { fitIconSize, shapeButtonLabel } from '../../../r3f/controls/native/buttonBase';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import type { SolveContext, TextureSlotsFn } from '../../../r3f/controls/native/solverRegistry';
import { getFontLinePitchPx } from '../../../r3f/controls/native/text/fontMetrics';
import { controlBidiOptions } from '../../../r3f/controls/native/text/textBidiOptions';
import { shapedTextSizeWidthPx, type TextLayoutResult } from '../../../r3f/controls/native/text/textLayout';
import {
  CHECKBOX_ICON_NATURAL_SIZE,
  CHECK_BOX_ICON_THEME_NAME,
  type CheckBoxIconKey,
  checkBoxTextureSlots,
} from '../../2d/ui/checkbox/nativeSolver';
import type { PopupMenuTheme } from './menuTheme';
import type { PopupMenuItem, PopupMenuProperties } from './types';

/** The texture slot of item `index`'s `icon` (`item_<n>/icon`). */
function menuItemIconSlot(index: number): string {
  return `item_${index}/icon`;
}

/** An item's icon and the eight check icons, as sizes `buildSolveTree` loads. */
export const popupMenuTextureSlots: TextureSlotsFn = (node, themedIcons = {}) => {
  const { items } = node.properties as PopupMenuProperties;
  const icons = items.flatMap((item, index) =>
    item.icon ? [{ key: menuItemIconSlot(index), ref: item.icon }] : []
  );
  return [...icons, ...checkBoxTextureSlots(node, themedIcons)];
};

export interface MenuItem {
  item: PopupMenuItem;
  /** `text_buf`, or `null` for an empty text, which neither measures nor draws. */
  text: TextLayoutResult | null;
  /** `text_buf->get_size()`: the ceiled extent. */
  textSize: Vector2;
  /** Whether the item's icon has loaded: Godot's `icon.is_valid()`, which an unresolved reference fails. */
  hasIcon: boolean;
  /** `_get_item_icon_size`: zero without a loaded icon. */
  iconSize: Vector2;
  /** `_get_item_height`. */
  height: number;
}

const CHECK_ICON_KEYS = Object.keys(CHECK_BOX_ICON_THEME_NAME) as readonly CheckBoxIconKey[];

/** The size of a check icon, which a theme replaces by name. */
export function checkIconSize(n: Pick<SolveNode, 'textureSlots'>, key: CheckBoxIconKey): Vector2 {
  return n.textureSlots[CHECK_BOX_ICON_THEME_NAME[key]] ?? CHECKBOX_ICON_NATURAL_SIZE;
}

/** The icons a checkable item draws, by `checkable_type - 1 + 2 * disabled` (`popup_menu.cpp:853-855`). */
const CHECKED_ICON_KEYS: readonly CheckBoxIconKey[] = [
  'checked',
  'radioChecked',
  'checkedDisabled',
  'radioCheckedDisabled',
];
const UNCHECKED_ICON_KEYS: readonly CheckBoxIconKey[] = [
  'unchecked',
  'radioUnchecked',
  'uncheckedDisabled',
  'radioUncheckedDisabled',
];

/** The icon a checkable item draws (`popup_menu.cpp:962-965`). */
export function checkIconKey(item: PopupMenuItem): CheckBoxIconKey {
  const keys = item.checked ? CHECKED_ICON_KEYS : UNCHECKED_ICON_KEYS;
  return keys[item.checkable - 1 + (item.disabled ? 2 : 0)]!;
}

/** The check icon every item reserves room for in the menu's minimum: the larger of `checked` and `radio_checked` (`popup_menu.cpp:279`). */
export function minimumCheckSize(n: Pick<SolveNode, 'textureSlots'>): Vector2 {
  const checked = checkIconSize(n, 'checked');
  const radio = checkIconSize(n, 'radioChecked');
  return { x: Math.max(checked.x, radio.x), y: Math.max(checked.y, radio.y) };
}

/** The widest of all eight check icons, which the draw reserves its gutter from (`popup_menu.cpp:889-894`). */
export function widestCheckIcon(n: Pick<SolveNode, 'textureSlots'>): number {
  return Math.max(...CHECK_ICON_KEYS.map((key) => checkIconSize(n, key).x));
}

/** `_get_item_icon_size` (`popup_menu.cpp:189-209`): the icon at its texture size, limited to `icon_max_width`. */
function itemIconSize(n: SolveNode, item: PopupMenuItem, index: number, theme: PopupMenuTheme): Vector2 {
  const natural = item.icon === undefined ? undefined : n.textureSlots[menuItemIconSlot(index)];
  return natural ? fitIconSize(natural, theme.iconMaxWidth) : { x: 0, y: 0 };
}

/** `_shape_item` (`popup_menu.cpp:1087-1107`): the text at the item's font, in the menu's layout direction. */
function shapeItem(n: SolveNode, item: PopupMenuItem, theme: PopupMenuTheme): TextLayoutResult | null {
  if (item.text.length === 0) return null;
  const font = item.separator ? theme.separatorFont : theme.font;
  return shapeButtonLabel(item.text, {
    fontSizePx: font.sizePx,
    fontMetrics: font.metrics,
    bidi: controlBidiOptions({ textDirection: TextDirection.TEXT_DIRECTION_INHERITED, language: '' }, n),
  });
}

/**
 * `_get_item_height` (`popup_menu.cpp:229-253`). Every term is an `int`, so each truncates. An item
 * with no text takes the font height unless it is a separator.
 */
function itemHeight(
  n: SolveNode,
  item: PopupMenuItem,
  textHeight: number,
  iconHeight: number,
  theme: PopupMenuTheme
): number {
  let icon = Math.trunc(iconHeight);
  if (item.checkable !== ItemCheckableType.NONE && !item.separator) {
    icon = Math.max(icon, Math.trunc(minimumCheckSize(n).y));
  }
  let text = Math.trunc(textHeight);
  if (text === 0 && !item.separator) {
    text = getFontLinePitchPx(theme.font.metrics, theme.font.sizePx, 0);
  }
  const separator = item.separator
    ? Math.trunc(
        Math.max(
          theme.separator.contentMargin.top + theme.separator.contentMargin.bottom,
          theme.labeledSeparatorLeft.contentMargin.top + theme.labeledSeparatorLeft.contentMargin.bottom,
          theme.labeledSeparatorRight.contentMargin.top + theme.labeledSeparatorRight.contentMargin.bottom
        )
      )
    : 0;
  return Math.max(separator, text, icon);
}

/** `items` of `n` as the menu measures them. Without a text engine an item's text measures as nothing. */
export function menuItems(
  n: SolveNode,
  theme: PopupMenuTheme,
  ctx: Pick<SolveContext, 'measureText'>,
  items: readonly PopupMenuItem[]
): readonly MenuItem[] {
  return items.map((item, index) => {
    const text = ctx.measureText ? shapeItem(n, item, theme) : null;
    const textSize = text ? { x: shapedTextSizeWidthPx(text.widthPx), y: text.heightPx } : { x: 0, y: 0 };
    const iconSize = itemIconSize(n, item, index, theme);
    const hasIcon = item.icon !== undefined && n.textureSlots[menuItemIconSlot(index)] !== undefined;
    return {
      item,
      text,
      textSize,
      hasIcon,
      iconSize,
      height: itemHeight(n, item, textSize.y, iconSize.y, theme),
    };
  });
}

/** What the gutter column holds: the widest icon, the widest check mark, and whether the compact layout applies. */
export interface Gutter {
  iconWidth: number;
  checkWidth: number;
  hasCheck: boolean;
  isCompact: boolean;
}

/** The width of the column before the text: one shared column when compact, else an icon column and a check column (`popup_menu.cpp:268-277,1043-1056`). */
export function gutterWidth(
  { iconWidth, checkWidth, hasCheck, isCompact }: Gutter,
  hSeparation: number
): number {
  if (isCompact) return Math.max(iconWidth, checkWidth) + hSeparation;
  const icon = iconWidth > 0 ? iconWidth + hSeparation : 0;
  return icon + (hasCheck ? checkWidth + hSeparation : 0);
}
