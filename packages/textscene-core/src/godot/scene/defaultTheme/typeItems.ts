/** The colour literals the default theme repeats, and the record of one type with every kind of item. */

import type { Rgba } from '../../math/math.js';
import type { DefaultThemeType } from './defaultTheme.js';

/** Frozen here, as the table that shares them is: no reader writes a colour it reads. */
export const WHITE: Rgba = Object.freeze({ r: 1, g: 1, b: 1, a: 1 });

/** `Color(1, 1, 1, a)`. */
export const whiteAt = (a: number): Rgba => ({ ...WHITE, a });
export const BLACK: Rgba = Object.freeze({ r: 0, g: 0, b: 0, a: 1 });
export const CLEAR: Rgba = Object.freeze({ r: 0, g: 0, b: 0, a: 0 });

/** `style_popup_border_color` (`default_theme.cpp:119`): the edge of a PopupMenu and between two unselected tabs. */
export const POPUP_BORDER_COLOR: Rgba = Object.freeze({ r: 0.175, g: 0.175, b: 0.175, a: 1 });

/** A type's items: each kind it sets none of is empty. */
export function typeItems(items: Partial<DefaultThemeType>): DefaultThemeType {
  return { colors: {}, constants: {}, fontSizes: {}, styles: {}, ...items };
}
