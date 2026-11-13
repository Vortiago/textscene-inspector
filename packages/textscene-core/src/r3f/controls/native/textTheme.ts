/**
 * Resolves the font size and colour of a text Control as plain data for `shapeText` and `TextRun`.
 * The override key names differ per widget (`font_size` and `font_color` for Label and Button,
 * `normal_font_size` and `default_color` for RichTextLabel), so the caller passes them in.
 */
import type { ShareNode } from './solveTree';
import { resolveNodeFontSizePx } from './text/resolveNodeFontMetrics';
import { requiredThemeItem } from './themeItems';
import type { Rgba } from '../../../godot/math/math';

export interface TextThemeKeys {
  /** The key of `theme_override_font_sizes/<sizeKey>` and of the ancestor `<Type>/font_sizes/<name>` lookup: Godot passes one `StringName` to both (`control.cpp:3107-3129`). */
  sizeKey: string;
  /** The key of `theme_override_colors/<colorKey>` and of the `<Type>/colors/<name>` entry `n.colors` was built under. */
  colorKey: string;
}

export interface TextThemeProps {
  themeOverrideFontSizes?: Record<string, number>;
}

export interface ResolvedTextTheme {
  fontSizePx: number;
  color: Rgba;
}

/**
 * Resolves size and colour independently, so one can be overridden while the other defaults. Size
 * walks `Control::get_theme_font_size` (`scene/gui/control.cpp:3107-3129`): an override of `0` falls
 * through (`:3114-3117`), and a theme's `default_font_size` answers when no entry matches
 * (`scene/resources/theme.cpp:658-666`). `defaultColor` is the colour of a type the default theme
 * table does not hold yet: Label's is opaque white (`default_theme.cpp:383`).
 */
export function resolveTextTheme(
  n: ShareNode,
  props: TextThemeProps,
  keys: TextThemeKeys,
  defaultColor?: Rgba
): ResolvedTextTheme {
  return {
    fontSizePx: resolveNodeFontSizePx(n, keys.sizeKey, props.themeOverrideFontSizes?.[keys.sizeKey]),
    color: n.colors[keys.colorKey] ?? defaultColor ?? requiredThemeItem(n.colors, keys.colorKey),
  };
}

export interface TextOutlineTheme {
  /** `font_outline_color`, sRGB. Godot's default is opaque black for most types (`default_theme.cpp:162` for Button). */
  color: Rgba;
  /** `outline_size`, px. The default theme sets 0 for every type, so no outline draws until a scene sets it. */
  sizePx: number;
}

const DEFAULT_OUTLINE_COLOR: Rgba = { r: 0, g: 0, b: 0, a: 1 };

/** The theme item names of one outline: a colour and a size constant. */
export interface OutlineItemNames {
  color: string;
  size: string;
}

const ITEM_OUTLINE_NAMES: OutlineItemNames = { color: 'font_outline_color', size: 'outline_size' };

/** The separator label's own outline items of a PopupMenu (`popup_menu.cpp:3314-3315`). */
export const SEPARATOR_OUTLINE_NAMES: OutlineItemNames = {
  color: 'font_separator_outline_color',
  size: 'separator_outline_size',
};

/**
 * The `font_outline_color` and `outline_size` theme items of a Control that draws its text through
 * `OutlinedTextRun` or a Label's effect layers. `names` picks another pair of items for a Control
 * that has two.
 */
export function resolveTextOutline(
  n: Pick<ShareNode, 'colors' | 'constants'>,
  names: OutlineItemNames = ITEM_OUTLINE_NAMES
): TextOutlineTheme {
  return {
    color: n.colors[names.color] ?? DEFAULT_OUTLINE_COLOR,
    sizePx: n.constants[names.size] ?? 0,
  };
}
