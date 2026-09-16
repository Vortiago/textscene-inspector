/**
 * Resolve a Control's theme font overrides — data, not CSS. Every text
 * Control repeats the same `theme_override_font_sizes/<key> → fontSizePx` and
 * `theme_override_colors/<key> → color` extraction; only the override key
 * NAMES differ (Label/Button read `font_size`/`font_color`; RichTextLabel
 * reads `normal_font_size`/`default_color`), so they are passed in rather than
 * hardcoded here. Returns a plain `ResolvedTextTheme` a native painter feeds
 * straight to `shapeText`/`TextRun`.
 *
 * Font SIZE resolves through Godot's FULL ancestor walk
 * (`Control::get_theme_font_size`, `scene/gui/control.cpp:3107-3129`, via
 * `resolveNodeFontSizePx`/`resolveThemeFontSizeIn`): a POSITIVE node-local
 * `theme_override_font_sizes/<sizeKey>` wins outright (`> 0` — an override of
 * `0` falls through exactly like an absent one, `:3114-3117`); otherwise the
 * nearest ancestor Control's own `theme` (then the project theme) supplies
 * `<nativeType>/font_sizes/<sizeKey>`, or that SAME theme's own
 * `default_font_size` when no more specific entry matches
 * (`Theme::get_font_size`, `scene/resources/theme.cpp:658-666`); otherwise
 * `defaults.fontSizePx` (this previewer's OWN `ThemeDB::get_fallback_font_size()`
 * stand-in). Colour walks the SAME ancestor chain via `n.colors`
 * (`buildSolveTree.ts`'s `resolveThemedColors`, `Control::get_theme_color`),
 * falling back to `defaults.color` only once nothing anywhere resolves it.
 */
import type { ControlColor } from '../../../nodes/2d/ui/control/types';
import type { SolveNode } from './solveTree';
import { resolveNodeFontSizePx } from './text/resolveNodeFontMetrics';

export interface TextThemeKeys {
  /** `theme_override_font_sizes/<sizeKey>` (e.g. `font_size`, `normal_font_size`) — ALSO the `<Type>/font_sizes/<name>` name `resolveNodeFontSizePx`'s ancestor walk looks up (Godot passes the SAME `StringName` to both the local-override read and `get_theme_font_size`, `control.cpp:3107-3129`). */
  sizeKey: string;
  /** `theme_override_colors/<colorKey>` (e.g. `font_color`, `default_color`) — ALSO the `<Type>/colors/<name>` name `n.colors` was built under (same StringName reused, mirroring `sizeKey`). */
  colorKey: string;
}

interface TextThemeProps {
  themeOverrideFontSizes?: Record<string, number>;
}

export interface TextThemeDefaults {
  /** The BUILT-IN default font size (already scaled by `default_theme_scale`), px — `resolveNodeFontSizePx`'s final rung, reached only once neither a node-local override nor any ancestor/project theme resolves `sizeKey`. */
  fontSizePx: number;
  /** The type's own default theme font colour — NOT necessarily `control_font_color`; e.g. Label's is opaque white (`default_theme.cpp`'s `set_color(font_color, "Label", Color(1,1,1))`), a different literal from most other widgets'. */
  color: ControlColor;
}

export interface ResolvedTextTheme {
  fontSizePx: number;
  color: ControlColor;
}

/**
 * `theme_override_font_sizes/<sizeKey>` / effectively `theme_override_colors/
 * <colorKey>` (already folded into `n.colors` by the walker). Colour and font
 * size resolve independently (`n.colors[keys.colorKey]` vs. `n`'s ancestor
 * Theme chain via `resolveNodeFontSizePx`), so one can be overridden while
 * the other still defaults.
 */
export function resolveTextTheme(
  n: SolveNode,
  props: TextThemeProps,
  keys: TextThemeKeys,
  defaults: TextThemeDefaults
): ResolvedTextTheme {
  return {
    fontSizePx: resolveNodeFontSizePx(n, keys.sizeKey, props.themeOverrideFontSizes?.[keys.sizeKey], defaults.fontSizePx),
    color: n.colors[keys.colorKey] ?? defaults.color,
  };
}
