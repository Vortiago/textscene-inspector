/**
 * The default theme's ItemList and Tree (`scene/theme/default_theme.cpp:858-970`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rgba } from '../../math/math.js';
import {
  CONTROL_FONT_COLOR,
  CONTROL_FONT_DISABLED_COLOR,
  CONTROL_FONT_HOVER_COLOR,
  CONTROL_FONT_LOW_COLOR,
  CONTROL_FONT_LOWER_COLOR,
  CONTROL_FONT_PRESSED_COLOR,
  scaledPx,
  STYLE_FILL,
} from '../theme.js';
import { buttonBoxes, focusStyleBox } from './button.js';
import type { DefaultStyleBox, DefaultThemeTypes } from './defaultTheme.js';
import { makeFlatStyleBox } from './styleBoxes.js';
import { BLACK, typeItems, WHITE } from './typeItems.js';

/** `Color(1, 1, 1, 0.07)`: the `hovered` row of ItemList and Tree (`default_theme.cpp:862`, `:961`). */
const HOVERED_FILL: Rgba = { r: 1, g: 1, b: 1, a: 0.07 };

/** `Color(1, 1, 1, 0.03)`: Tree's `hovered_dimmed` row (`default_theme.cpp:863`). */
const HOVERED_DIMMED_FILL: Rgba = { r: 1, g: 1, b: 1, a: 0.03 };

/** `Color(0.7, 0.7, 0.7, 0.25)`: the `guide_color` of ItemList and Tree (`default_theme.cpp:906`, `:959`). */
const GUIDE_COLOR: Rgba = { r: 0.7, g: 0.7, b: 0.7, a: 0.25 };

/** `Color(0.27, 0.27, 0.27)`: Tree's relationship lines (`default_theme.cpp:908-910`). */
const RELATIONSHIP_LINE_COLOR: Rgba = { r: 0.27, g: 0.27, b: 0.27, a: 1 };

/** The row boxes ItemList and Tree share (`default_theme.cpp:861-869`, `:961-967`). */
function rowBoxes(scale: number, focus: DefaultStyleBox): Readonly<Record<string, DefaultStyleBox>> {
  const flat = (color: Rgba) => makeFlatStyleBox(scale, color);
  return {
    focus,
    hovered: flat(HOVERED_FILL),
    hovered_selected: flat(STYLE_FILL.hoverSelected),
    hovered_selected_focus: flat(STYLE_FILL.hoverSelected),
    selected: flat(STYLE_FILL.selected),
    selected_focus: flat(STYLE_FILL.selected),
    cursor: focus,
    cursor_unfocused: focus,
  };
}

export function listTypes(scale: number): DefaultThemeTypes {
  const rounded = (length: number) => scaledPx(length, scale);
  const focus = focusStyleBox(scale);
  const button = buttonBoxes(scale);
  const flat = (color: Rgba) => makeFlatStyleBox(scale, color);
  return {
    Tree: typeItems({
      styles: {
        ...rowBoxes(scale, focus),
        panel: makeFlatStyleBox(scale, STYLE_FILL.normal, {
          margin: { left: 4, top: 4, right: 4, bottom: 5 },
        }),
        hovered_dimmed: flat(HOVERED_DIMMED_FILL),
        // `:872` sets `button_hover` a second time, to `button_hover`, after `:870`'s translucent white.
        button_hover: button.hover,
        button_pressed: button.pressed,
        title_button_normal: flat(STYLE_FILL.pressed),
        title_button_pressed: flat(STYLE_FILL.hover),
        title_button_hover: flat(STYLE_FILL.normal),
        custom_button: button.normal,
        custom_button_pressed: button.pressed,
        custom_button_hover: button.hover,
      },
      colors: {
        title_button_color: CONTROL_FONT_COLOR,
        font_color: CONTROL_FONT_LOW_COLOR,
        font_hovered_color: CONTROL_FONT_HOVER_COLOR,
        font_hovered_dimmed_color: CONTROL_FONT_COLOR,
        font_hovered_selected_color: CONTROL_FONT_PRESSED_COLOR,
        font_selected_color: CONTROL_FONT_PRESSED_COLOR,
        font_disabled_color: CONTROL_FONT_DISABLED_COLOR,
        font_outline_color: BLACK,
        guide_color: GUIDE_COLOR,
        drop_position_color: WHITE,
        relationship_line_color: RELATIONSHIP_LINE_COLOR,
        parent_hl_line_color: RELATIONSHIP_LINE_COLOR,
        children_hl_line_color: RELATIONSHIP_LINE_COLOR,
        custom_button_font_highlight: CONTROL_FONT_HOVER_COLOR,
        scroll_hint_color: BLACK,
      },
      constants: {
        h_separation: rounded(4),
        v_separation: rounded(4),
        item_margin: rounded(16),
        inner_item_margin_bottom: 0,
        inner_item_margin_left: 0,
        inner_item_margin_right: 0,
        inner_item_margin_top: 0,
        check_h_separation: rounded(4),
        icon_h_separation: rounded(4),
        button_margin: rounded(4),
        draw_relationship_lines: 0,
        relationship_line_width: 1,
        parent_hl_line_width: 1,
        children_hl_line_width: 1,
        parent_hl_line_margin: 0,
        draw_guides: 1,
        dragging_unfold_wait_msec: 500,
        scroll_border: rounded(4),
        scroll_speed: 12,
        outline_size: 0,
        icon_max_width: 0,
        scrollbar_margin_left: -1,
        scrollbar_margin_top: -1,
        scrollbar_margin_right: -1,
        scrollbar_margin_bottom: -1,
        scrollbar_h_separation: rounded(4),
        scrollbar_v_separation: rounded(4),
      },
    }),
    ItemList: typeItems({
      styles: { ...rowBoxes(scale, focus), panel: makeFlatStyleBox(scale, STYLE_FILL.normal) },
      colors: {
        font_color: CONTROL_FONT_LOWER_COLOR,
        font_hovered_color: CONTROL_FONT_HOVER_COLOR,
        font_hovered_selected_color: CONTROL_FONT_PRESSED_COLOR,
        font_selected_color: CONTROL_FONT_PRESSED_COLOR,
        font_outline_color: BLACK,
        guide_color: GUIDE_COLOR,
        scroll_hint_color: BLACK,
      },
      constants: {
        h_separation: rounded(4),
        v_separation: rounded(4),
        icon_margin: rounded(4),
        line_separation: rounded(2),
        outline_size: 0,
      },
    }),
  };
}
