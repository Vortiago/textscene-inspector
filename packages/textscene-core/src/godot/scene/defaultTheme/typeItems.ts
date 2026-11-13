/** The colour literals the default theme repeats, and the record of one type with every kind of item. */

import type { Rgba } from '../../math/math.js';
import type { DefaultThemeType } from './defaultTheme.js';

export const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };
export const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
export const CLEAR: Rgba = { r: 0, g: 0, b: 0, a: 0 };

/** A type's items: each kind it sets none of is empty. */
export function typeItems(items: Partial<DefaultThemeType>): DefaultThemeType {
  return { colors: {}, constants: {}, fontSizes: {}, styles: {}, ...items };
}
