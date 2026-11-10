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
import { CONTROL_FONT_COLOR, DEFAULT_CORNER_RADIUS } from '../../../godot/scene/theme';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { styleBoxLineBox, type ResolvedStyleBox } from '../../../r3f/controls/native/parseStyleBox';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { flatStyleBox } from '../../../r3f/controls/native/styleBoxFlat';
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
}

/**
 * `make_flat_stylebox(style_popup_color)` with a 2 px border (`default_theme.cpp:743-745`). Its corner
 * detail is `MIN(ceil(1.5 * radius), 6) * scale` (`:65`), which a bare `flatStyleBox` leaves at 8.
 */
function defaultPanel(theme: NativeTheme): ResolvedStyleBox {
  const margin = theme.contentMargin;
  const panel = flatStyleBox(theme.styleFill.popup, {
    contentMargin: { left: margin, top: margin, right: margin, bottom: margin },
    cornerRadius: theme.cornerRadius,
    borderWidth: POPUP_MENU_DEFAULTS.panelBorderWidth,
    borderColor: POPUP_MENU_DEFAULTS.panelBorderColor,
  });
  return { ...panel, cornerDetail: Math.min(Math.ceil(1.5 * DEFAULT_CORNER_RADIUS), 6) * theme.scale };
}

function scaled(base: number, theme: NativeTheme): number {
  return Math.round(base * theme.scale);
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
    panel: styleBoxes.panel ?? defaultPanel(theme),
    separator: styleBoxes.separator ?? separator,
    labeledSeparatorLeft: styleBoxes.labeled_separator_left ?? separator,
    labeledSeparatorRight: styleBoxes.labeled_separator_right ?? separator,
    vSeparation: n.constants.v_separation ?? scaled(defaults.vSeparation, theme),
    hSeparation: n.constants.h_separation ?? scaled(defaults.hSeparation, theme),
    itemStartPadding: n.constants.item_start_padding ?? scaled(defaults.itemStartPadding, theme),
    itemEndPadding: n.constants.item_end_padding ?? scaled(defaults.itemEndPadding, theme),
    iconMaxWidth: n.constants.icon_max_width ?? defaults.iconMaxWidth,
    isGutterCompact: (n.constants.gutter_compact ?? defaults.gutterCompact) !== 0,
    font: menuFont(n, theme, 'font', 'font_size'),
    separatorFont: menuFont(n, theme, 'font_separator', 'font_separator_size'),
    fontColor: n.colors.font_color ?? CONTROL_FONT_COLOR,
    fontDisabledColor: n.colors.font_disabled_color ?? defaults.fontDisabledColor,
    fontSeparatorColor: n.colors.font_separator_color ?? CONTROL_FONT_COLOR,
  };
}
