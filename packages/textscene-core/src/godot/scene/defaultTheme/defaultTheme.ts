/**
 * Godot's default theme as one table (`ThemeDB::get_default_theme`, `scene/theme/theme_db.cpp:86`, filled
 * by `fill_default_theme`, `scene/theme/default_theme.cpp:92-1357`): the last theme every theme lookup
 * reads. Plain data: a StyleBox here is the fields Godot sets, which `r3f/` turns into a drawn box.
 */

import type { Rgba } from '../../math/math.js';
import { scaledPx, DEFAULT_FONT_SIZE } from '../theme.js';
import { buttonTypes } from './button.js';
import { containerTypes } from './containers.js';
import { labelTypes } from './label.js';
import { rangeTypes } from './ranges.js';
import { tabTypes } from './tabs.js';

export interface Sides {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface Corners {
  readonly topLeft: number;
  readonly topRight: number;
  readonly bottomRight: number;
  readonly bottomLeft: number;
}

/** A `StyleBoxFlat` as `make_flat_stylebox` leaves it. Every length is scaled and rounded. */
export interface DefaultFlatStyleBox {
  readonly kind: 'flat';
  readonly bgColor: Rgba;
  readonly contentMargin: Sides;
  readonly cornerRadius: Corners;
  readonly cornerDetail: number;
  readonly borderWidth: Sides;
  readonly borderColor: Rgba;
  readonly expandMargin: Sides;
  readonly drawCenter: boolean;
}

/** A `StyleBoxEmpty`. A margin of -1 or less is unset. */
export interface DefaultEmptyStyleBox {
  readonly kind: 'empty';
  readonly contentMargin: Sides;
}

/** A `StyleBoxLine`: a rule across the box, as the separators set it. A margin of -1 or less is unset. */
export interface DefaultLineStyleBox {
  readonly kind: 'line';
  readonly color: Rgba;
  readonly thickness: number;
  readonly vertical: boolean;
  readonly growBegin: number;
  readonly growEnd: number;
  readonly contentMargin: Sides;
}

export type DefaultStyleBox = DefaultFlatStyleBox | DefaultEmptyStyleBox | DefaultLineStyleBox;

/** The items of one type, keyed by item name as Godot keys them. Default icons and fonts are not here. */
export interface DefaultThemeType {
  readonly colors: Readonly<Record<string, Rgba>>;
  readonly constants: Readonly<Record<string, number>>;
  readonly fontSizes: Readonly<Record<string, number>>;
  readonly styles: Readonly<Record<string, DefaultStyleBox>>;
}

export type DefaultThemeTypes = Readonly<Record<string, DefaultThemeType>>;

export interface DefaultTheme {
  readonly scale: number;
  /** `Math::round(16 * scale)` (`default_theme.cpp:97`). */
  readonly defaultFontSize: number;
  readonly types: DefaultThemeTypes;
}

/** Written only by `defaultThemeAt`. Never cleared: a page holds a few scales. */
const themesByScale = new Map<number, DefaultTheme>();

/** The default theme at `scale`, built once for each scale and frozen to the leaves. */
export function defaultThemeAt(scale: number): DefaultTheme {
  let theme = themesByScale.get(scale);
  if (!theme) {
    theme = deepFreeze(buildDefaultTheme(scale));
    themesByScale.set(scale, theme);
  }
  return theme;
}

function buildDefaultTheme(scale: number): DefaultTheme {
  return {
    scale,
    defaultFontSize: scaledPx(DEFAULT_FONT_SIZE, scale),
    types: {
      ...buttonTypes(scale),
      ...labelTypes(scale),
      ...rangeTypes(scale),
      ...containerTypes(scale),
      ...tabTypes(scale),
    },
  };
}

/** Freezes `value` and every object under it. Two types share one box, so an edit through one would reach the other. */
function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}
