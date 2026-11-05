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
function fontSizeOf(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const sizePx = stringToInt(value);
  return sizePx > 0 ? sizePx : undefined;
}

/** A `[outline_size=N]` payload: a negative size is 0 (`push_outline_size(MAX(0, n))`, `:6370`). */
function outlineSizeOf(value: string): number {
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

/** Chooses one value among the open tags of a kind, or `undefined` for none. */
export type TagValuePick = (tags: readonly OpenBBCodeTag[], name: string) => string | undefined;

/** The `[outline_size]` and `[outline_color]` that `pick` finds, each `undefined` where no tag sets it. */
export interface TagOutline {
  sizePx: number | undefined;
  color: Rgba | undefined;
}

/** The outline tags of `tags` as `pick` chooses them. An unreadable colour is `defaultColor` (`:6155`). */
export function tagOutlineOf(
  tags: readonly OpenBBCodeTag[],
  pick: TagValuePick,
  defaultColor: Rgba
): TagOutline {
  const sizeValue = pick(tags, 'outline_size');
  const colorValue = pick(tags, 'outline_color');
  return {
    sizePx: sizeValue === undefined ? undefined : outlineSizeOf(sizeValue),
    color: colorValue === undefined ? undefined : resolveBBColor(colorValue, defaultColor),
  };
}

/** The outline of a run: the innermost `[outline_size]` and `[outline_color]`, each over the theme's. */
export function tagOutline(
  tags: readonly OpenBBCodeTag[],
  themeOutline: TextOutlineTheme,
  defaultColor: Rgba
): TextOutlineTheme {
  const { sizePx, color } = tagOutlineOf(tags, lastTagValue, defaultColor);
  return { sizePx: sizePx ?? themeOutline.sizePx, color: color ?? themeOutline.color };
}
