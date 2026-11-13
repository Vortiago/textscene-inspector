/**
 * The default theme's text fields: LineEdit, TextEdit and CodeEdit (`scene/theme/default_theme.cpp:403-537`).
 * The three share the `normal` and `read_only` boxes of LineEdit.
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
  CONTROL_FONT_PLACEHOLDER_COLOR,
  CONTROL_FONT_PRESSED_COLOR,
  LINE_EDIT_BORDER_BOTTOM_WIDTH,
  LINE_EDIT_MINIMUM_CHARACTER_WIDTH,
  STYLE_FILL,
  scaledPx,
} from '../theme.js';
import { focusStyleBox } from './button.js';
import type { DefaultFlatStyleBox, DefaultStyleBox, DefaultThemeTypes } from './defaultTheme.js';
import { allSides, makeFlatStyleBox, withBorder } from './styleBoxes.js';
import { BLACK, CLEAR, typeItems } from './typeItems.js';

/** `control_selection_color` (`default_theme.cpp:109`). */
const CONTROL_SELECTION_COLOR: Rgba = { r: 0.5, g: 0.5, b: 0.5, a: 1 };

/**
 * A field box with the bottom line that tells it from a Button (`default_theme.cpp:405-417`). The width is
 * set after `make_flat_stylebox`, so the theme scale never reaches it.
 */
function fieldBox(scale: number, fill: Rgba, line: Rgba): DefaultFlatStyleBox {
  return withBorder(
    makeFlatStyleBox(scale, fill),
    { ...allSides(0), bottom: LINE_EDIT_BORDER_BOTTOM_WIDTH },
    line
  );
}

/** The `normal`, `focus` and `read_only` boxes all three types set (`:409-417`, `:453-455`, `:486-488`). */
function fieldBoxes(scale: number): Readonly<Record<string, DefaultStyleBox>> {
  const pressed = STYLE_FILL.pressed;
  return {
    normal: fieldBox(scale, STYLE_FILL.normal, pressed),
    focus: focusStyleBox(scale),
    read_only: fieldBox(scale, STYLE_FILL.disabled, { ...pressed, a: pressed.a * 0.5 }),
  };
}

/** The colours TextEdit and CodeEdit both set (`:466-478`, `:507-532`). */
const TEXT_EDIT_COLORS: Readonly<Record<string, Rgba>> = {
  background_color: CLEAR,
  font_color: CONTROL_FONT_COLOR,
  font_selected_color: CLEAR,
  font_readonly_color: CONTROL_FONT_DISABLED_COLOR,
  font_placeholder_color: CONTROL_FONT_PLACEHOLDER_COLOR,
  font_outline_color: BLACK,
  selection_color: CONTROL_SELECTION_COLOR,
  current_line_color: { r: 0.25, g: 0.25, b: 0.26, a: 0.8 },
  caret_color: CONTROL_FONT_COLOR,
  caret_background_color: BLACK,
  search_result_color: { r: 0.3, g: 0.3, b: 0.3, a: 1 },
  search_result_border_color: { r: 0.3, g: 0.3, b: 0.3, a: 0.4 },
};

export function textEditTypes(scale: number): DefaultThemeTypes {
  const boxes = fieldBoxes(scale);
  const lineSpacing = scaledPx(4, scale);
  return {
    LineEdit: typeItems({
      styles: boxes,
      colors: {
        font_color: CONTROL_FONT_COLOR,
        font_selected_color: CONTROL_FONT_PRESSED_COLOR,
        font_uneditable_color: CONTROL_FONT_DISABLED_COLOR,
        font_placeholder_color: CONTROL_FONT_PLACEHOLDER_COLOR,
        font_outline_color: BLACK,
        caret_color: CONTROL_FONT_HOVER_COLOR,
        selection_color: CONTROL_SELECTION_COLOR,
        clear_button_color: CONTROL_FONT_COLOR,
        clear_button_color_pressed: CONTROL_FONT_PRESSED_COLOR,
      },
      constants: {
        minimum_character_width: LINE_EDIT_MINIMUM_CHARACTER_WIDTH,
        outline_size: 0,
        caret_width: 1,
      },
    }),
    TextEdit: typeItems({
      styles: boxes,
      colors: {
        ...TEXT_EDIT_COLORS,
        word_highlighted_color: { r: 0.5, g: 0.5, b: 0.5, a: 0.25 },
      },
      constants: { line_spacing: lineSpacing, outline_size: 0, caret_width: 1, wrap_offset: 10 },
    }),
    CodeEdit: typeItems({
      styles: { ...boxes, completion: makeFlatStyleBox(scale, STYLE_FILL.normal, { margin: allSides(0) }) },
      colors: {
        ...TEXT_EDIT_COLORS,
        word_highlighted_color: { r: 0.8, g: 0.9, b: 0.9, a: 0.15 },
        completion_background_color: { r: 0.17, g: 0.16, b: 0.2, a: 1 },
        completion_selected_color: { r: 0.26, g: 0.26, b: 0.27, a: 1 },
        completion_existing_color: { r: 0.87, g: 0.87, b: 0.87, a: 0.13 },
        completion_scroll_color: { ...CONTROL_FONT_PRESSED_COLOR, a: 0.29 },
        completion_scroll_hovered_color: { ...CONTROL_FONT_PRESSED_COLOR, a: 0.4 },
        bookmark_color: { r: 0.5, g: 0.64, b: 1, a: 0.8 },
        breakpoint_color: { r: 0.9, g: 0.29, b: 0.3, a: 1 },
        executing_line_color: { r: 0.98, g: 0.89, b: 0.27, a: 1 },
        code_folding_color: { r: 0.8, g: 0.8, b: 0.8, a: 0.8 },
        folded_code_region_color: { r: 0.68, g: 0.46, b: 0.77, a: 0.2 },
        brace_mismatch_color: { r: 1, g: 0.2, b: 0.2, a: 1 },
        line_number_color: { r: 0.67, g: 0.67, b: 0.67, a: 0.4 },
        line_length_guideline_color: { r: 0.3, g: 0.5, b: 0.8, a: 0.1 },
      },
      constants: {
        completion_lines: 7,
        completion_max_width: 50,
        completion_scroll_width: 6,
        line_spacing: lineSpacing,
        outline_size: 0,
      },
    }),
  };
}
