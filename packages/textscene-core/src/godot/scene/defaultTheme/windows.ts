/**
 * The default theme's Window, dialogs and popups (`scene/theme/default_theme.cpp:672-785`): Window,
 * AcceptDialog, FileDialog, PopupPanel, PopupDialog and PopupMenu.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rgba } from '../../math/math.js';
import { CONTROL_FONT_COLOR, scaledPx, STYLE_FILL } from '../theme.js';
import { separatorLine } from './containers.js';
import type { DefaultThemeType, DefaultThemeTypes } from './defaultTheme.js';
import { allSides, makeFlatStyleBox, withBorder, withExpandMargin } from './styleBoxes.js';
import { BLACK, POPUP_BORDER_COLOR, typeItems, WHITE } from './typeItems.js';

/**
 * Window (`default_theme.cpp:672-688`). `set_constant` takes an `int`, so `36 * scale`, `18 * scale` and
 * `24 * scale` truncate where `resize_margin`'s `Math::round` rounds.
 */
function window(scale: number): DefaultThemeType {
  const border = (color: Rgba) =>
    withExpandMargin(
      makeFlatStyleBox(scale, color, { margin: { left: 10, top: 28, right: 10, bottom: 8 } }),
      scale,
      { left: 8, top: 32, right: 8, bottom: 6 }
    );
  return typeItems({
    styles: {
      embedded_border: border(STYLE_FILL.popup),
      embedded_unfocused_border: border(STYLE_FILL.popupHover),
    },
    colors: { title_color: CONTROL_FONT_COLOR, title_outline_modulate: BLACK },
    constants: {
      title_outline_size: 0,
      title_height: Math.trunc(36 * scale),
      resize_margin: scaledPx(4, scale),
      close_h_offset: Math.trunc(18 * scale),
      close_v_offset: Math.trunc(24 * scale),
    },
  });
}

/**
 * AcceptDialog (`default_theme.cpp:693-694`): the base of every dialog. The call passes `Math::round(8 * scale)`
 * as the margin, and `make_flat_stylebox` scales that margin again.
 */
function acceptDialog(scale: number): DefaultThemeType {
  const margin = allSides(scaledPx(8, scale));
  return typeItems({
    styles: { panel: makeFlatStyleBox(scale, STYLE_FILL.popup, { margin, cornerRadius: 0 }) },
    constants: { buttons_separation: scaledPx(10, scale) },
  });
}

/** FileDialog (`default_theme.cpp:696-722`). Its icons are not in the table. */
function fileDialog(): DefaultThemeType {
  return typeItems({
    colors: { folder_icon_color: WHITE, file_icon_color: WHITE, file_disabled_color: { ...WHITE, a: 0.25 } },
    constants: { thumbnail_size: 64 },
  });
}

/** PopupMenu (`default_theme.cpp:732-785`). The panel's `set_border_width_all(2)` is unscaled. */
function popupMenu(scale: number): DefaultThemeType {
  const rounded = (length: number) => scaledPx(length, scale);
  const separator = separatorLine(scale, false);
  return typeItems({
    styles: {
      panel: withBorder(makeFlatStyleBox(scale, STYLE_FILL.popup), allSides(2), POPUP_BORDER_COLOR),
      hover: makeFlatStyleBox(scale, STYLE_FILL.popupHover),
      separator,
      labeled_separator_left: separator,
      labeled_separator_right: separator,
    },
    colors: {
      font_color: CONTROL_FONT_COLOR,
      font_accelerator_color: { r: 0.7, g: 0.7, b: 0.7, a: 0.8 },
      font_disabled_color: { r: 0.4, g: 0.4, b: 0.4, a: 0.8 },
      font_hover_color: CONTROL_FONT_COLOR,
      font_separator_color: CONTROL_FONT_COLOR,
      font_outline_color: BLACK,
      font_separator_outline_color: BLACK,
    },
    constants: {
      indent: rounded(10),
      h_separation: rounded(4),
      v_separation: rounded(4),
      outline_size: 0,
      separator_outline_size: 0,
      item_start_padding: rounded(2),
      item_end_padding: rounded(2),
      icon_max_width: 0,
      gutter_compact: 1,
    },
  });
}

export function windowTypes(scale: number): DefaultThemeTypes {
  const popupPanel = typeItems({ styles: { panel: makeFlatStyleBox(scale, STYLE_FILL.normal) } });
  return {
    Window: window(scale),
    AcceptDialog: acceptDialog(scale),
    FileDialog: fileDialog(),
    PopupPanel: popupPanel,
    PopupDialog: popupPanel,
    PopupMenu: popupMenu(scale),
  };
}
