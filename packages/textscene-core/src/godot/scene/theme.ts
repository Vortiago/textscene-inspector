/**
 * Godot 4.6.3's default theme font colours (`fill_default_theme`, `scene/theme/default_theme.cpp:101-108`),
 * which a Control draws with when no theme overrides them.
 */

import type { Rgba } from '../math/math.js';

/** `control_font_color` (`default_theme.cpp:101`), the `font_color` default of most Controls. */
export const CONTROL_FONT_COLOR: Rgba = { r: 0.875, g: 0.875, b: 0.875, a: 1 };

/** `control_font_low_color` (`default_theme.cpp:102`). */
export const CONTROL_FONT_LOW_COLOR: Rgba = { r: 0.7, g: 0.7, b: 0.7, a: 1 };

/** `control_font_lower_color` (`default_theme.cpp:103`). */
export const CONTROL_FONT_LOWER_COLOR: Rgba = { r: 0.65, g: 0.65, b: 0.65, a: 1 };

/** `control_font_hover_color` (`default_theme.cpp:104`). */
export const CONTROL_FONT_HOVER_COLOR: Rgba = { r: 0.95, g: 0.95, b: 0.95, a: 1 };

/** `control_font_disabled_color`: {@link CONTROL_FONT_COLOR} at half alpha (`default_theme.cpp:106`). */
export const CONTROL_FONT_DISABLED_COLOR: Rgba = { ...CONTROL_FONT_COLOR, a: 0.5 };

/** `control_font_placeholder_color`: {@link CONTROL_FONT_COLOR} at 0.6 alpha (`default_theme.cpp:107`). */
export const CONTROL_FONT_PLACEHOLDER_COLOR: Rgba = { ...CONTROL_FONT_COLOR, a: 0.6 };

/** `control_font_pressed_color` (`default_theme.cpp:108`). */
export const CONTROL_FONT_PRESSED_COLOR: Rgba = { r: 1, g: 1, b: 1, a: 1 };
