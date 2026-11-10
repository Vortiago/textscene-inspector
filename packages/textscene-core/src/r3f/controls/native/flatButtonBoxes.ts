/**
 * The default theme's `FlatButton` and `FlatMenuButton` variations (`scene/theme/default_theme.cpp:357-375`): an
 * empty box that keeps the button's content margins in every state but pressed, which draws a darker button box.
 * React-free: the boxes are plain data.
 */

import { neutralStyleBox } from '../../../resources/styles/stylebox/decode';
import type { NativeTheme } from './nativeTheme';
import type { StyleBoxFlatData } from './styleBoxFlat';

/** The theme items a `FlatButton` reads, keyed as `Button` reads them. */
export type FlatButtonBoxes = Readonly<Record<'normal' | 'hover' | 'pressed' | 'disabled', StyleBoxFlatData>>;

/** `flat_button_pressed` (`default_theme.cpp:363-364`): `button_pressed` with `style_pressed_color * Color(1, 1, 1, 0.85)`. */
const PRESSED_ALPHA = 0.85;

export function flatButtonBoxes(theme: NativeTheme): FlatButtonBoxes {
  const { normal, pressed } = theme.widgets.button;
  // `button_normal->get_margin(side) + get_border_width(side)` (`default_theme.cpp:361-363`).
  const margin = {
    left: normal.contentMargin.left + normal.borderWidth.left,
    top: normal.contentMargin.top + normal.borderWidth.top,
    right: normal.contentMargin.right + normal.borderWidth.right,
    bottom: normal.contentMargin.bottom + normal.borderWidth.bottom,
  };
  const empty = neutralStyleBox(margin);
  return {
    normal: empty,
    hover: empty,
    disabled: empty,
    pressed: { ...pressed, bgColor: { ...pressed.bgColor, a: pressed.bgColor.a * PRESSED_ALPHA } },
  };
}
