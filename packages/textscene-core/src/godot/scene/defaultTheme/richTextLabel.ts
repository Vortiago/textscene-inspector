/**
 * The default theme's RichTextLabel (`scene/theme/default_theme.cpp:1185-1232`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { scaledPx } from '../theme.js';
import { focusStyleBox } from './button.js';
import type { DefaultThemeTypes } from './defaultTheme.js';
import { allSides, makeEmptyStyleBox } from './styleBoxes.js';
import { BLACK, CLEAR, WHITE, typeItems } from './typeItems.js';

export function richTextLabelTypes(scale: number): DefaultThemeTypes {
  const rounded = (length: number) => scaledPx(length, scale);
  return {
    RichTextLabel: typeItems({
      styles: { focus: focusStyleBox(scale), normal: makeEmptyStyleBox(scale, allSides(0)) },
      colors: {
        default_color: WHITE,
        font_selected_color: CLEAR,
        selection_color: { r: 0.1, g: 0.1, b: 1, a: 0.8 },
        font_shadow_color: CLEAR,
        font_outline_color: BLACK,
        table_odd_row_bg: CLEAR,
        table_even_row_bg: CLEAR,
        table_border: CLEAR,
      },
      constants: {
        shadow_offset_x: rounded(1),
        shadow_offset_y: rounded(1),
        shadow_outline_size: rounded(1),
        line_separation: 0,
        paragraph_separation: 0,
        table_h_separation: rounded(3),
        table_v_separation: rounded(3),
        outline_size: 0,
        text_highlight_h_padding: rounded(3),
        text_highlight_v_padding: rounded(3),
        underline_alpha: 50,
        strikethrough_alpha: 50,
      },
    }),
  };
}
