/**
 * The `[font_size]`, `[outline_size]` and `[outline_color]` of an open tag stack: the items
 * `RichTextLabel` finds by walking a text item's parents (`rich_text_label.cpp:3311-3338`, `:3575-3588`).
 */
import { stringToInt } from '../../../../godot/string/string';
import type { Rgba } from '../../../../godot/math/math';
import type { TextOutlineTheme } from '../../../../r3f/controls/native/textTheme';
import { lastTagValue, resolveBBColor, type OpenBBCodeTag } from './bbcode';

/** The innermost `[font_size=N]`, or `undefined` for none or an `N` of 0 or less (`font_size_it->font_size > 0`). */
export function tagFontSizePx(tags: readonly OpenBBCodeTag[]): number | undefined {
  return fontSizeOf(lastTagValue(tags, 'font_size'));
}

/** A `[font_size=N]` payload, or `undefined` for none or an `N` of 0 or less. */
export function fontSizeOf(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const sizePx = stringToInt(value);
  return sizePx > 0 ? sizePx : undefined;
}

/** A `[outline_size=N]` payload: a negative size is 0 (`push_outline_size(MAX(0, n))`, `:6370`). */
export function outlineSizeOf(value: string): number {
  return Math.max(0, stringToInt(value));
}

/**
 * A `[font_size=N]` payload as a list marker reads it: any `N` but -1 is the marker's size,
 * including 0 and below, which shape nothing (`item_font_size != -1`, `rich_text_label.cpp:362`).
 */
export function markerFontSizeOf(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const sizePx = stringToInt(value);
  return sizePx === -1 ? undefined : sizePx;
}

/**
 * The outline of a run: the innermost `[outline_size]` and `[outline_color]`, each over the theme's.
 * An unreadable colour is `defaultColor` (`:6155`).
 */
export function tagOutline(
  tags: readonly OpenBBCodeTag[],
  themeOutline: TextOutlineTheme,
  defaultColor: Rgba
): TextOutlineTheme {
  const sizeValue = lastTagValue(tags, 'outline_size');
  const colorValue = lastTagValue(tags, 'outline_color');
  return {
    sizePx: sizeValue === undefined ? themeOutline.sizePx : outlineSizeOf(sizeValue),
    color: colorValue === undefined ? themeOutline.color : resolveBBColor(colorValue, defaultColor),
  };
}
