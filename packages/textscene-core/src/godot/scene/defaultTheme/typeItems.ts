/** The colour literals the default theme repeats, and the record of one type with every kind of item. */

import type { Rgba } from '../../math/math.js';
import type { DefaultThemeType } from './defaultTheme.js';

/** Frozen here, as the table that shares them is: no reader writes a colour it reads. */
export const WHITE: Rgba = Object.freeze({ r: 1, g: 1, b: 1, a: 1 });
export const BLACK: Rgba = Object.freeze({ r: 0, g: 0, b: 0, a: 1 });
export const CLEAR: Rgba = Object.freeze({ r: 0, g: 0, b: 0, a: 0 });

/** A type's items: each kind it sets none of is empty. */
export function typeItems(items: Partial<DefaultThemeType>): DefaultThemeType {
  return { colors: {}, constants: {}, fontSizes: {}, styles: {}, ...items };
}
