/**
 * The theme items a PopupMenu reads (`PopupMenu::_update_theme_item_cache`, `popup_menu.cpp:1326-1337`
 * and `popup_menu.h:176-230`): each from the node's overrides, its theme chain, then the default theme.
 * Pure: no React, no THREE.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rgba } from '../../../godot/math/math';
import { POPUP_MENU_DEFAULTS } from '../../../godot/scene/popupMenu';
import { CONTROL_FONT_COLOR, scaledPx } from '../../../godot/scene/theme';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { styleBoxLineBox, type ResolvedStyleBox } from '../../../r3f/controls/native/parseStyleBox';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import {
  resolveTextOutline,
  SEPARATOR_OUTLINE_NAMES,
  type TextOutlineTheme,
} from '../../../r3f/controls/native/textTheme';
import type { FontMetrics } from '../../../r3f/controls/native/text/fontMetrics';
import {
  resolveNodeFontMetrics,
  resolveNodeFontSizePx,
} from '../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { WindowProperties } from '../window/types';
import { defaultSeparatorStyleBoxLine } from '../../2d/ui/separator/styleBoxLine';

/** A font and its size, as `theme_cache.font` and `font_size` hold them. */
interface MenuFont {
  metrics: FontMetrics;
  sizePx: number;
}

export interface PopupMenuTheme {
  panel: ResolvedStyleBox;
  separator: ResolvedStyleBox;
  labeledSeparatorLeft: ResolvedStyleBox;
  labeledSeparatorRight: ResolvedStyleBox;
  vSeparation: number;
  hSeparation: number;
  itemStartPadding: number;
  itemEndPadding: number;
  iconMaxWidth: number;
  isGutterCompact: boolean;
  font: MenuFont;
  separatorFont: MenuFont;
  fontColor: Rgba;
  fontDisabledColor: Rgba;
  fontSeparatorColor: Rgba;
  outline: TextOutlineTheme;
  separatorOutline: TextOutlineTheme;
}

function menuFont(n: SolveNode, theme: NativeTheme, fontKey: string, sizeKey: string): MenuFont {
  const { themeOverrideFontSizes } = n.node.properties as WindowProperties;
  return {
    metrics: resolveNodeFontMetrics(n, fontKey),
    sizePx: resolveNodeFontSizePx(n, sizeKey, themeOverrideFontSizes?.[sizeKey], theme.fontSize),
  };
}

export function popupMenuTheme(n: SolveNode, theme: NativeTheme): PopupMenuTheme {
  const defaults = POPUP_MENU_DEFAULTS;
  const separator = styleBoxLineBox(defaultSeparatorStyleBoxLine('horizontal', theme));
  const styleBoxes = n.styleBoxes;
  return {
    panel: styleBoxes.panel ?? theme.widgets.popupMenuPanel,
    separator: styleBoxes.separator ?? separator,
    labeledSeparatorLeft: styleBoxes.labeled_separator_left ?? separator,
    labeledSeparatorRight: styleBoxes.labeled_separator_right ?? separator,
    vSeparation: n.constants.v_separation ?? scaledPx(defaults.vSeparation, theme.scale),
    hSeparation: n.constants.h_separation ?? scaledPx(defaults.hSeparation, theme.scale),
    itemStartPadding: n.constants.item_start_padding ?? scaledPx(defaults.itemStartPadding, theme.scale),
    itemEndPadding: n.constants.item_end_padding ?? scaledPx(defaults.itemEndPadding, theme.scale),
    iconMaxWidth: n.constants.icon_max_width ?? defaults.iconMaxWidth,
    isGutterCompact: (n.constants.gutter_compact ?? defaults.gutterCompact) !== 0,
    font: menuFont(n, theme, 'font', 'font_size'),
    separatorFont: menuFont(n, theme, 'font_separator', 'font_separator_size'),
    fontColor: n.colors.font_color ?? CONTROL_FONT_COLOR,
    fontDisabledColor: n.colors.font_disabled_color ?? defaults.fontDisabledColor,
    fontSeparatorColor: n.colors.font_separator_color ?? CONTROL_FONT_COLOR,
    outline: resolveTextOutline(n),
    separatorOutline: resolveTextOutline(n, undefined, SEPARATOR_OUTLINE_NAMES),
  };
}
