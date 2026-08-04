/**
 * Resolve a Control's theme font overrides — data, not CSS. Every text
 * Control repeats the same `theme_override_font_sizes/<key> → fontSizePx` and
 * `theme_override_colors/<key> → color` extraction; only the override key
 * NAMES differ (Label/Button read `font_size`/`font_color`; RichTextLabel
 * reads `normal_font_size`/`default_color`), so they are passed in rather than
 * hardcoded here. Returns a plain `ResolvedTextTheme` a native painter feeds
 * straight to `shapeText`/`TextRun`.
 */
import type { ControlColor } from '../../../nodes/2d/ui/control/types';

export interface TextThemeKeys {
  /** `theme_override_font_sizes/<sizeKey>` (e.g. `font_size`, `normal_font_size`). */
  sizeKey: string;
  /** `theme_override_colors/<colorKey>` (e.g. `font_color`, `default_color`). */
  colorKey: string;
}

interface TextThemeProps {
  themeOverrideFontSizes?: Record<string, number>;
  themeOverrideColors?: Record<string, ControlColor>;
}

export interface TextThemeDefaults {
  /** The theme's own default font size (already scaled by `default_theme_scale`), px. */
  fontSizePx: number;
  /** The type's own default theme font colour — NOT necessarily `control_font_color`; e.g. Label's is opaque white (`default_theme.cpp`'s `set_color(font_color, "Label", Color(1,1,1))`), a different literal from most other widgets'. */
  color: ControlColor;
}

export interface ResolvedTextTheme {
  fontSizePx: number;
  color: ControlColor;
}

/** `theme_override_font_sizes/<sizeKey>` / `theme_override_colors/<colorKey>`, falling back to `defaults` — resolved independently, so one can be overridden while the other still defaults. */
export function resolveTextTheme(
  props: TextThemeProps,
  keys: TextThemeKeys,
  defaults: TextThemeDefaults
): ResolvedTextTheme {
  return {
    fontSizePx: props.themeOverrideFontSizes?.[keys.sizeKey] ?? defaults.fontSizePx,
    color: props.themeOverrideColors?.[keys.colorKey] ?? defaults.color,
  };
}
