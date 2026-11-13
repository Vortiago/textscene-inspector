/**
 * The default-theme data the native Control solver and painters read:
 * `ScaledGodotTheme` unchanged, plus the StyleBoxFlat fill colours as 0..1
 * `Color` components, because a native painter multiplies vertex colours
 * rather than setting a CSS `rgba(...)` background.
 */

import { scaledGodotTheme, STYLE_FILL, type ScaledGodotTheme } from '../../../godot/scene/theme';
import type { Rgba } from '../../../godot/math/math';

/**
 * The default flat stylebox's fill by draw state, from `scene/theme/default_theme.cpp`'s
 * `fill_default_theme`, which scales every length it passes to `make_flat_stylebox` but never a
 * `Color` literal, so the colours are not scaled.
 */
interface NativeThemeStyleFill {
  /** `style_normal_color` = `Color(0.1, 0.1, 0.1, 0.6)`. */
  normal: Rgba;
  /** `style_hover_color` = `Color(0.225, 0.225, 0.225, 0.6)`. */
  hover: Rgba;
  /** `style_pressed_color` = `Color(0, 0, 0, 0.6)`. */
  pressed: Rgba;
  /** `style_disabled_color` = `Color(0.1, 0.1, 0.1, 0.3)`. */
  disabled: Rgba;
  /** `style_popup_color` = `Color(0.25, 0.25, 0.25, 1)`. */
  popup: Rgba;
  /** `style_popup_hover_color` = `Color(0.4, 0.4, 0.4, 1)`. */
  popupHover: Rgba;
  /** `style_progress_color` = `Color(1, 1, 1, 0.4)`, ProgressBar's `fill`. */
  progress: Rgba;
}

export interface NativeTheme extends ScaledGodotTheme {
  styleFill: NativeThemeStyleFill;
}

/**
 * Written only by `nativeTheme`, never cleared. Keyed, not one entry: two open previews of
 * projects with different scales would otherwise rebuild the theme and miss each per-theme memo.
 */
const themesByScale = new Map<number, NativeTheme>();

/** `NativeTheme` at a project's `gui/theme/default_theme_scale`, built once per scale: a walker per scene tile asks for the same one. */
export function nativeTheme(scale: number): NativeTheme {
  let theme = themesByScale.get(scale);
  if (!theme) {
    theme = buildNativeTheme(scale);
    themesByScale.set(scale, theme);
  }
  return theme;
}

function buildNativeTheme(scale: number): NativeTheme {
  return { ...scaledGodotTheme(scale), styleFill: STYLE_FILL };
}
