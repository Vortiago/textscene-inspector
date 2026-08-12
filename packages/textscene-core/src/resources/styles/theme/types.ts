/**
 * The Theme slice's decoded data (ADR-0031).
 *
 * A Godot `Theme` `.tres` carries StyleBoxes, colors, constants, icons, font
 * sizes and fonts, keyed by `<Type>/<data_type>/<name>`
 * (`Theme::_set`/`_get`, `scene/resources/theme.cpp:36-104`: the property name
 * splits on `/` into `theme_type` / `data_type` / `prop_name`) plus a handful
 * of un-prefixed scalars (`default_font`, `default_font_size`) and
 * `<variationType>/base_type` type-variation declarations. The decode covers
 * only what a font lookup needs; everything else (styles, colors, constants,
 * icons) stays a raw property string for a future consumer — the same shallow
 * contract every other Godot-text slice uses.
 */

import type { FontResource } from '../../fonts/font/types';

/**
 * The shape both a file-backed Theme (`T` = address string, resolved later by
 * awaiting the loader) and a scene-inline one (`T` = `FontResource`, resolved
 * immediately by reading scope) decode to. `ThemeAddresses` and
 * `ThemeResource` are this shape at each of those two `T`s.
 */
export interface ScannedTheme<T> {
  defaultFont: T | null;
  defaultFontSize: number | undefined;
  fonts: Readonly<Record<string, Readonly<Record<string, T>>>>;
  fontSizes: Readonly<Record<string, Readonly<Record<string, number>>>>;
  typeVariations: Readonly<Record<string, string>>;
  properties: Readonly<Record<string, string>>;
}

/**
 * A Theme's font-relevant data, decoded to typed values but with every Font
 * reference left as a **Sub-resource path** ADDRESS rather than a resolved
 * `FontResource` — the seam between the format decode (`decode.ts`) and
 * `loadTheme.ts`'s `resolveThemeResource`, which awaits the loader for each
 * one. Used for a FILE-BACKED Theme only; a scene-inline one resolves straight
 * to a `ThemeResource` via `resolveInlineThemeResource` instead.
 */
export type ThemeAddresses = ScannedTheme<string>;

/**
 * A Theme, decoded to the point a font lookup can use it: every Font reference
 * resolved to a `FontResource`, everything else still raw. See `scanTheme`'s
 * doc for the validity-collapse this shares with `ThemeAddresses`.
 */
export type ThemeResource = ScannedTheme<FontResource>;
