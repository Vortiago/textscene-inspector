/**
 * The Theme slice's decoded data (ADR-0031).
 *
 * A Godot `Theme` `.tres` carries StyleBoxes, colors, constants, icons, font
 * sizes and fonts, keyed by `<Type>/<data_type>/<name>`
 * (`Theme::_set`/`_get`, `scene/resources/theme.cpp:36-104`: the property name
 * splits on `/` into `theme_type` / `data_type` / `prop_name`) plus a handful
 * of un-prefixed scalars (`default_font`, `default_font_size`) and
 * `<variationType>/base_type` type-variation declarations. `styles`/`icons`
 * stay a raw ref string each (a StyleBox or a Texture2D icon is a
 * SUB-RESOURCE of this theme file, resolved against `resources` by whoever
 * reads the entry, never here); `colors`/`constants` are literal values with
 * nothing to resolve, so they decode straight to typed data.
 */

import type { FontResource } from '../../fonts/font/types';
import type { SceneScope } from '../../../parser/types';
import type { Color } from '../../../utils/colorParser';

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
  /**
   * `<Type>/styles/<name>` — raw ref string (`SubResource(...)`/`ExtResource(...)`),
   * resolved against `resources`. Optional (unlike every other field here, all
   * of which `scanTheme` always populates) purely so a `ThemeResource` literal
   * hand-built before this field existed keeps compiling; a real decode always
   * sets it, and a reader treats an absent map as empty.
   */
  styles?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** `<Type>/colors/<name>`, parsed (`Theme::get_color`, `scene/resources/theme.cpp:761-767`). Optional — see `styles`'s own doc. */
  colors?: Readonly<Record<string, Readonly<Record<string, Color>>>>;
  /** `<Type>/icons/<name>` — raw ref string (`SubResource(...)`/`ExtResource(...)`), resolved against `resources`, same as `styles`. Optional — see `styles`'s own doc. */
  icons?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** `<Type>/constants/<name>`, parsed (`Theme::get_constant`, `scene/resources/theme.cpp:858-864`) — a literal int, never scaled. Optional — see `styles`'s own doc. */
  constants?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  typeVariations: Readonly<Record<string, string>>;
  properties: Readonly<Record<string, string>>;
  /** This theme file's OWN sub-resource pools — what a `styles`/icon ref addresses against, never the referencing node's. Optional — see `styles`'s own doc. */
  resources?: SceneScope;
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
