/**
 * The Theme slice's decoded data (ADR-0031). A `Theme` keys its items by
 * `<Type>/<data_type>/<name>` (`Theme::_set`/`_get`, `scene/resources/theme.cpp:36-104`),
 * plus `default_font`, `default_font_size` and `<variationType>/base_type`.
 */

import type { FontResource } from '../../fonts/font/types';
import type { SceneScope } from '../../../parser/types';
import type { Color } from '../../../utils/colorParser';

/**
 * The shape a file-backed Theme (`T` = address string, awaited later) and a
 * scene-inline one (`T` = `FontResource`, read from scope) decode to.
 */
export interface ScannedTheme<T> {
  defaultFont: T | null;
  defaultFontSize: number | undefined;
  fonts: Readonly<Record<string, Readonly<Record<string, T>>>>;
  fontSizes: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /**
   * `<Type>/styles/<name>`: a raw ref string, which the reader resolves against
   * `resources`. Optional so a hand-built `ThemeResource` literal compiles. A
   * decode always sets it, and a reader treats an absent map as empty.
   */
  styles?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** `<Type>/colors/<name>`, parsed (`Theme::get_color`, `scene/resources/theme.cpp:761-767`). Optional, as `styles`. */
  colors?: Readonly<Record<string, Readonly<Record<string, Color>>>>;
  /** `<Type>/icons/<name>`: a raw ref string (`SubResource(...)`/`ExtResource(...)`), resolved as `styles`. Optional, as `styles`. */
  icons?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** `<Type>/constants/<name>`, parsed (`Theme::get_constant`, `scene/resources/theme.cpp:858-864`): a literal int, never scaled. Optional, as `styles`. */
  constants?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  typeVariations: Readonly<Record<string, string>>;
  properties: Readonly<Record<string, string>>;
  /** This theme file's own sub-resource pools, which a `styles` or icon ref addresses, never the node's. Optional, as `styles`. */
  resources?: SceneScope;
}

/**
 * A file-backed Theme with each Font reference left as a **Sub-resource path**
 * address. `loadTheme.ts`'s `resolveThemeResource` awaits the loader for each.
 * A scene-inline Theme goes straight to a `ThemeResource` instead.
 */
export type ThemeAddresses = ScannedTheme<string>;

/**
 * A Theme with every Font reference resolved to a `FontResource`. See
 * `scanTheme` for the validity collapse it shares with `ThemeAddresses`.
 */
export type ThemeResource = ScannedTheme<FontResource>;
