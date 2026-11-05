/**
 * The `Window` items of Godot's default theme (`scene/theme/default_theme.cpp:672-688`): what an
 * embedder draws a window's decoration with when no theme and no override answers.
 */

import type { Rgba } from '../../../godot/math/math';
import { CONTROL_FONT_COLOR } from '../../../godot/scene/theme';
import type { NativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { flatStyleBox, type StyleBoxFlatData } from '../../../r3f/controls/native/styleBoxFlat';

export interface WindowThemeDefaults {
  /** `embedded_border`: the focused window's frame. */
  embeddedBorder: StyleBoxFlatData;
  /** `embedded_unfocused_border`: every other window's frame. */
  embeddedUnfocusedBorder: StyleBoxFlatData;
  titleColor: Rgba;
  titleOutlineModulate: Rgba;
  titleOutlineSize: number;
  titleHeight: number;
  closeHOffset: number;
  closeVOffset: number;
}

type Sides = { left: number; top: number; right: number; bottom: number };

/** Each side times `scale`, rounded on its own (`make_flat_stylebox`, `sb_expand`, `:57-79`). */
function scaledSides(left: number, top: number, right: number, bottom: number, scale: number): Sides {
  return {
    left: Math.round(left * scale),
    top: Math.round(top * scale),
    right: Math.round(right * scale),
    bottom: Math.round(bottom * scale),
  };
}

/** `sb_expand(make_flat_stylebox(color, 10, 28, 10, 8), 8, 32, 8, 6)` (`:674-675`). */
function embeddedBorder(color: Rgba, theme: NativeTheme): StyleBoxFlatData {
  return flatStyleBox(color, {
    contentMargin: scaledSides(10, 28, 10, 8, theme.scale),
    cornerRadius: theme.cornerRadius,
    expandMargin: scaledSides(8, 32, 8, 6, theme.scale),
  });
}

/** The constant `set_constant` stores: a scaled float converted to `int`, which truncates. */
function scaledConstant(value: number, scale: number): number {
  return Math.trunc(value * scale);
}

/** PopupPanel's `panel`: `make_flat_stylebox(style_normal_color)` (`default_theme.cpp:726`). */
export function popupPanelDefaultStyle(theme: NativeTheme): StyleBoxFlatData {
  const margin = theme.contentMargin;
  return flatStyleBox(theme.styleFill.normal, {
    contentMargin: { left: margin, top: margin, right: margin, bottom: margin },
    cornerRadius: theme.cornerRadius,
  });
}

export function windowThemeDefaults(theme: NativeTheme): WindowThemeDefaults {
  return {
    embeddedBorder: embeddedBorder(theme.styleFill.popup, theme),
    embeddedUnfocusedBorder: embeddedBorder(theme.styleFill.popupHover, theme),
    titleColor: CONTROL_FONT_COLOR,
    titleOutlineModulate: { r: 0, g: 0, b: 0, a: 1 },
    titleOutlineSize: 0,
    titleHeight: scaledConstant(36, theme.scale),
    closeHOffset: scaledConstant(18, theme.scale),
    closeVOffset: scaledConstant(24, theme.scale),
  };
}
