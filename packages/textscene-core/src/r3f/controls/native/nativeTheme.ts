/**
 * `NativeTheme` — the default-theme data the native (WebGL) Control solver and
 * painters read, extending `ScaledGodotTheme` (`../godotDefaultTheme.ts`, kept
 * framework-free on purpose) with the numeric StyleBoxFlat fill colours the
 * DOM overlay only ever needed as CSS strings.
 *
 * `scaledGodotTheme(scale)` is NOT re-transcribed here — every scalable
 * metric (font size, corner radius, margins, separation, slider geometry)
 * passes through unchanged. What's added is genuinely new for this renderer:
 * the default flat stylebox's fill colour per draw state, as raw
 * `Color(r, g, b, a)` components (0..1 floats) rather than the `rgba(...)`
 * CSS strings `godotDefaultTheme.ts` exports, because the native painter
 * multiplies vertex colours instead of setting a CSS background.
 *
 * Colours are NOT scaled — `default_theme_scale` only affects geometry
 * (`scene/theme/default_theme.cpp::fill_default_theme` scales every length it
 * passes to `make_flat_stylebox`, never a `Color` literal).
 *
 * Later packets extend this same interface/factory with per-widget
 * `StyleBoxFlatData` structs built FROM these fills (P5: button
 * normal/hover/pressed/disabled, panel, ScrollBar scroll/grabber) — this
 * packet only lays the numeric fill colours those structs compose from, and
 * the `ScaledGodotTheme` base every scalable metric belongs to.
 */

import type { ControlColor } from '../../../nodes/2d/ui/control/types';
import { scaledGodotTheme, STYLE_FILL, type ScaledGodotTheme } from '../godotDefaultTheme';

/**
 * The default flat stylebox's fill, by draw state — `scene/theme/default_theme.cpp`,
 * `fill_default_theme`:
 *  - `style_normal_color` = `Color(0.1, 0.1, 0.1, 0.6)`.
 *  - `style_hover_color` = `Color(0.225, 0.225, 0.225, 0.6)`.
 *  - `style_pressed_color` = `Color(0, 0, 0, 0.6)`.
 *  - `style_disabled_color` = `Color(0.1, 0.1, 0.1, 0.3)`.
 *  - `style_popup_color` = `Color(0.25, 0.25, 0.25, 1)`.
 *  - `style_progress_color` = `Color(1, 1, 1, 0.4)` (the sliders' filled
 *    `grabber_area`).
 */
export interface NativeThemeStyleFill {
  normal: ControlColor;
  hover: ControlColor;
  pressed: ControlColor;
  disabled: ControlColor;
  popup: ControlColor;
  progress: ControlColor;
}

export interface NativeTheme extends ScaledGodotTheme {
  styleFill: NativeThemeStyleFill;
}

/** `NativeTheme` at a project's `gui/theme/default_theme_scale`. */
export function nativeTheme(scale: number): NativeTheme {
  return {
    ...scaledGodotTheme(scale),
    styleFill: STYLE_FILL,
  };
}
