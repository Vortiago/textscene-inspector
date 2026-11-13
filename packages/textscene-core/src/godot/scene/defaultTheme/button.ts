/**
 * The default theme's Button family (`scene/theme/default_theme.cpp:136-375`, `:1131-1151`): Button,
 * MenuBar, LinkButton, OptionButton, MenuButton, CheckBox, CheckButton, ColorPickerButton and the
 * variations FlatButton and FlatMenuButton.
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
  CONTROL_FONT_FOCUS_COLOR,
  CONTROL_FONT_HOVER_COLOR,
  CONTROL_FONT_PRESSED_COLOR,
  DEFAULT_CONTENT_MARGIN,
  scaledPx,
  STYLE_FILL,
} from '../theme.js';
import type {
  DefaultFlatStyleBox,
  DefaultStyleBox,
  DefaultThemeType,
  DefaultThemeTypes,
  Sides,
} from './defaultTheme.js';
import { allSides, emptyStyleBox, makeFlatStyleBox, withExpandMargin } from './styleBoxes.js';
import { BLACK, typeItems, WHITE } from './typeItems.js';

/** `flat_button_pressed` (`default_theme.cpp:363-364`): `style_pressed_color * Color(1, 1, 1, 0.85)`. */
const FLAT_BUTTON_PRESSED_ALPHA = 0.85;

type StateBoxes<B extends DefaultStyleBox = DefaultStyleBox> = Readonly<
  Record<'normal' | 'hover' | 'pressed' | 'disabled', B>
>;

/**
 * `button_normal`, `button_hover`, `button_pressed` and `button_disabled` (`default_theme.cpp:138-141`),
 * or OptionButton's twins of them with its own `margin` (`:212-215`).
 */
function buttonBoxes(scale: number, margin?: Sides): StateBoxes<DefaultFlatStyleBox> {
  const box = (color: Rgba) => makeFlatStyleBox(scale, color, { margin });
  return {
    normal: box(STYLE_FILL.normal),
    hover: box(STYLE_FILL.hover),
    pressed: box(STYLE_FILL.pressed),
    disabled: box(STYLE_FILL.disabled),
  };
}

/**
 * `focus` (`default_theme.cpp:142-144`): an uncentred ring of width 2, expanded by 2 so it sits flush
 * outside the Control it marks. Button, the Button family and Label share it.
 */
export function focusStyleBox(scale: number): DefaultFlatStyleBox {
  const ring = makeFlatStyleBox(scale, STYLE_FILL.focus, { drawCenter: false, borderWidth: 2 });
  return withExpandMargin(ring, scale, allSides(2));
}

/** The font colours most of the family sets (`default_theme.cpp:156-162`). */
const FONT_COLORS: Readonly<Record<string, Rgba>> = {
  font_color: CONTROL_FONT_COLOR,
  font_pressed_color: CONTROL_FONT_PRESSED_COLOR,
  font_hover_color: CONTROL_FONT_HOVER_COLOR,
  font_focus_color: CONTROL_FONT_FOCUS_COLOR,
  font_hover_pressed_color: CONTROL_FONT_PRESSED_COLOR,
  font_disabled_color: CONTROL_FONT_DISABLED_COLOR,
  font_outline_color: BLACK,
};

function button(scale: number, boxes: StateBoxes, focus: DefaultStyleBox): DefaultThemeType {
  return typeItems({
    styles: { ...boxes, focus },
    colors: {
      ...FONT_COLORS,
      icon_normal_color: WHITE,
      icon_pressed_color: WHITE,
      icon_hover_color: WHITE,
      icon_hover_pressed_color: WHITE,
      icon_focus_color: WHITE,
      icon_disabled_color: { ...WHITE, a: 0.4 },
    },
    constants: {
      outline_size: 0,
      h_separation: scaledPx(4, scale),
      icon_max_width: 0,
      align_to_largest_stylebox: 0,
    },
  });
}

/** `default_theme.cpp:176-194`: Button's boxes and colours, with no focus box or icon colours. */
function menuBar(scale: number, boxes: StateBoxes): DefaultThemeType {
  return typeItems({
    styles: boxes,
    colors: FONT_COLORS,
    constants: { outline_size: 0, h_separation: scaledPx(4, scale) },
  });
}

/** `default_theme.cpp:196-208`. */
function linkButton(scale: number, focus: DefaultStyleBox): DefaultThemeType {
  const { font_hover_pressed_color: _notSet, font_disabled_color: _alsoNotSet, ...colors } = FONT_COLORS;
  return typeItems({
    styles: { focus },
    colors,
    constants: { outline_size: 0, underline_spacing: scaledPx(2, scale) },
  });
}

/** `default_theme.cpp:210-250`: twice `default_margin` across, and a `_mirrored` twin of each box. */
function optionButton(scale: number, focus: DefaultStyleBox): DefaultThemeType {
  const margin = {
    left: 2 * DEFAULT_CONTENT_MARGIN,
    top: DEFAULT_CONTENT_MARGIN,
    right: 2 * DEFAULT_CONTENT_MARGIN,
    bottom: DEFAULT_CONTENT_MARGIN,
  };
  const boxes = buttonBoxes(scale, margin);
  return typeItems({
    styles: {
      focus,
      ...boxes,
      normal_mirrored: boxes.normal,
      hover_mirrored: boxes.hover,
      pressed_mirrored: boxes.pressed,
      disabled_mirrored: boxes.disabled,
    },
    colors: FONT_COLORS,
    constants: {
      h_separation: scaledPx(4, scale),
      arrow_margin: scaledPx(4, scale),
      outline_size: 0,
      modulate_arrow: 0,
    },
  });
}

/** `default_theme.cpp:252-271`. */
function menuButton(scale: number, boxes: StateBoxes, focus: DefaultStyleBox): DefaultThemeType {
  const { font_hover_pressed_color: _notSet, ...colors } = FONT_COLORS;
  return typeItems({
    styles: { ...boxes, focus },
    colors: { ...colors, font_disabled_color: { ...WHITE, a: 0.3 } },
    constants: { h_separation: scaledPx(4, scale), outline_size: 0 },
  });
}

/**
 * CheckBox and CheckButton (`default_theme.cpp:273-350`): one `StyleBoxEmpty` for every state and
 * `hover_pressed`, and the colours of the check's icon.
 */
function checkClass(
  scale: number,
  empty: DefaultStyleBox,
  focus: DefaultStyleBox,
  iconColorNames: readonly [string, string]
): DefaultThemeType {
  return typeItems({
    styles: { normal: empty, pressed: empty, disabled: empty, hover: empty, hover_pressed: empty, focus },
    colors: { ...FONT_COLORS, [iconColorNames[0]]: WHITE, [iconColorNames[1]]: WHITE },
    constants: { h_separation: scaledPx(4, scale), check_v_offset: 0, outline_size: 0 },
  });
}

/** `default_theme.cpp:1131-1151`: Button's boxes with lighter text colours. */
function colorPickerButton(scale: number, boxes: StateBoxes, focus: DefaultStyleBox): DefaultThemeType {
  return typeItems({
    styles: { ...boxes, focus },
    colors: {
      font_color: WHITE,
      font_pressed_color: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
      font_hover_color: WHITE,
      font_focus_color: WHITE,
      font_disabled_color: { r: 0.9, g: 0.9, b: 0.9, a: 0.3 },
      font_outline_color: BLACK,
    },
    constants: { h_separation: scaledPx(4, scale), outline_size: 0 },
  });
}

/**
 * FlatButton and FlatMenuButton (`default_theme.cpp:357-375`): an empty box that keeps `button_normal`'s
 * margins plus its border, and `button_pressed` a little clearer.
 */
function flatButton(boxes: Readonly<Record<'normal' | 'pressed', DefaultFlatStyleBox>>): DefaultThemeType {
  const { contentMargin: m, borderWidth: b } = boxes.normal;
  const empty = emptyStyleBox({
    left: m.left + b.left,
    top: m.top + b.top,
    right: m.right + b.right,
    bottom: m.bottom + b.bottom,
  });
  const { bgColor } = boxes.pressed;
  const pressed = { ...boxes.pressed, bgColor: { ...bgColor, a: bgColor.a * FLAT_BUTTON_PRESSED_ALPHA } };
  return typeItems({ styles: { normal: empty, hover: empty, pressed, disabled: empty } });
}

export function buttonTypes(scale: number): DefaultThemeTypes {
  const boxes = buttonBoxes(scale);
  const focus = focusStyleBox(scale);
  const flat = flatButton(boxes);
  const checkBoxEmpty = emptyStyleBox(allSides(scaledPx(4, scale)));
  const checkButtonEmpty = emptyStyleBox({
    left: scaledPx(6, scale),
    top: scaledPx(4, scale),
    right: scaledPx(6, scale),
    bottom: scaledPx(4, scale),
  });
  return {
    Button: button(scale, boxes, focus),
    MenuBar: menuBar(scale, boxes),
    LinkButton: linkButton(scale, focus),
    OptionButton: optionButton(scale, focus),
    MenuButton: menuButton(scale, boxes, focus),
    CheckBox: checkClass(scale, checkBoxEmpty, focus, ['checkbox_checked_color', 'checkbox_unchecked_color']),
    CheckButton: checkClass(scale, checkButtonEmpty, focus, [
      'button_checked_color',
      'button_unchecked_color',
    ]),
    ColorPickerButton: colorPickerButton(scale, boxes, focus),
    FlatButton: flat,
    FlatMenuButton: flat,
  };
}
