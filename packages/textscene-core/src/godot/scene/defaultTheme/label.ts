/**
 * The default theme's Label and the Label variations (`scene/theme/default_theme.cpp:377-401`, `:814-826`,
 * `:845-856`, `:1171-1181`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rgba } from '../../math/math.js';
import { CONTROL_FONT_COLOR, DEFAULT_FONT_SIZE, LABEL_FONT_COLOR, scaledPx } from '../theme.js';
import type { DefaultThemeType, DefaultThemeTypes } from './defaultTheme.js';
import { focusStyleBox } from './button.js';
import { allSides, emptyStyleBox, makeEmptyStyleBox } from './styleBoxes.js';
import { BLACK, CLEAR, typeItems } from './typeItems.js';

/** The colours a Label-based type sets, with its own `font_color`. */
function labelColors(fontColor: Rgba, outlineColor: Rgba = BLACK): Readonly<Record<string, Rgba>> {
  return { font_color: fontColor, font_shadow_color: CLEAR, font_outline_color: outlineColor };
}

/**
 * Label's constants (`default_theme.cpp:390-394`), which GraphNodeTitleLabel (`:822-826`) and
 * GraphFrameTitleLabel (`:852-856`) repeat. `scaled` turns an unscaled length into the stored int.
 */
function labelConstants(scaled: (length: number) => number): Readonly<Record<string, number>> {
  return {
    shadow_offset_x: scaled(1),
    shadow_offset_y: scaled(1),
    outline_size: 0,
    shadow_outline_size: scaled(1),
    line_spacing: scaled(3),
  };
}

/** A header variation's size: `default_font_size + step`, unscaled (`default_theme.cpp:396-401`). */
function header(step: number): DefaultThemeType {
  return typeItems({ fontSizes: { font_size: DEFAULT_FONT_SIZE + step } });
}

/**
 * GraphFrameTitleLabel (`default_theme.cpp:845-856`). `set_constant` takes an `int`, so `1 * scale`
 * truncates where Label's `Math::round` would round.
 */
function graphFrameTitleLabel(scale: number): DefaultThemeType {
  return typeItems({
    colors: labelColors(LABEL_FONT_COLOR, LABEL_FONT_COLOR),
    constants: labelConstants((length) => Math.trunc(length * scale)),
    fontSizes: { font_size: 22 },
    styles: { normal: emptyStyleBox() },
  });
}

export function labelTypes(scale: number): DefaultThemeTypes {
  const rounded = (length: number) => scaledPx(length, scale);
  return {
    Label: typeItems({
      colors: labelColors(LABEL_FONT_COLOR),
      constants: labelConstants(rounded),
      styles: { normal: emptyStyleBox(), focus: focusStyleBox(scale) },
    }),
    HeaderSmall: header(4),
    HeaderMedium: header(8),
    HeaderLarge: header(12),
    GraphNodeTitleLabel: typeItems({
      colors: labelColors(CONTROL_FONT_COLOR),
      constants: labelConstants(rounded),
      styles: { normal: makeEmptyStyleBox(scale, allSides(0)) },
    }),
    GraphFrameTitleLabel: graphFrameTitleLabel(scale),
    TooltipLabel: typeItems({
      colors: labelColors(CONTROL_FONT_COLOR),
      constants: { shadow_offset_x: 1, shadow_offset_y: 1, outline_size: 0 },
    }),
  };
}
