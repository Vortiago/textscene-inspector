/**
 * Resolves the font size and colour of a text Control as plain data for `shapeText` and `TextRun`.
 * The override key names differ per widget (`font_size` and `font_color` for Label and Button,
 * `normal_font_size` and `default_color` for RichTextLabel), so the caller passes them in.
 */
import type { ControlColor } from '../../../nodes/2d/ui/control/types';
import type { ShareNode } from './solveTree';
import { resolveNodeFontSizePx } from './text/resolveNodeFontMetrics';

export interface TextThemeKeys {
  /** The key of `theme_override_font_sizes/<sizeKey>` and of the ancestor `<Type>/font_sizes/<name>` lookup: Godot passes one `StringName` to both (`control.cpp:3107-3129`). */
  sizeKey: string;
  /** The key of `theme_override_colors/<colorKey>` and of the `<Type>/colors/<name>` entry `n.colors` was built under. */
  colorKey: string;
}

interface TextThemeProps {
  themeOverrideFontSizes?: Record<string, number>;
}

export interface TextThemeDefaults {
  /** The built-in default font size, px, scaled by `default_theme_scale`: the last rung when no override or theme resolves `sizeKey`. */
  fontSizePx: number;
  /** The type's default theme font colour, not always `control_font_color`: Label's is opaque white (`set_color(font_color, "Label", Color(1,1,1))` in `default_theme.cpp`). */
  color: ControlColor;
}

export interface ResolvedTextTheme {
  fontSizePx: number;
  color: ControlColor;
}

/**
 * Resolves size and colour independently, so one can be overridden while the other defaults. Size
 * walks `Control::get_theme_font_size` (`scene/gui/control.cpp:3107-3129`): an override of `0` falls
 * through (`:3114-3117`), and a theme's `default_font_size` answers when no entry matches
 * (`scene/resources/theme.cpp:658-666`).
 */
export function resolveTextTheme(
  n: ShareNode,
  props: TextThemeProps,
  keys: TextThemeKeys,
  defaults: TextThemeDefaults
): ResolvedTextTheme {
  return {
    fontSizePx: resolveNodeFontSizePx(n, keys.sizeKey, props.themeOverrideFontSizes?.[keys.sizeKey], defaults.fontSizePx),
    color: n.colors[keys.colorKey] ?? defaults.color,
  };
}
