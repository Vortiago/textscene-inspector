/**
 * Godot 4.6.3's default theme (`fill_default_theme`, `scene/theme/default_theme.cpp`): the font colours,
 * the flat stylebox fills and the metrics a Control draws with when no theme overrides them.
 */

import type { Rgba } from '../math/math.js';

/**
 * What the fallback theme answers for an item no theme holds, the last step of every lookup
 * (`theme_owner.cpp:258-259`): a default `Color()`, opaque black, and a constant of 0.
 */
export const FALLBACK_THEME_COLOR: Rgba = { r: 0, g: 0, b: 0, a: 1 };
export const FALLBACK_THEME_CONSTANT = 0;

/** `control_font_color` (`default_theme.cpp:101`), the `font_color` default of most Controls. */
export const CONTROL_FONT_COLOR: Rgba = { r: 0.875, g: 0.875, b: 0.875, a: 1 };

/** `control_font_low_color` (`default_theme.cpp:102`). */
export const CONTROL_FONT_LOW_COLOR: Rgba = { r: 0.7, g: 0.7, b: 0.7, a: 1 };

/** `control_font_lower_color` (`default_theme.cpp:103`). */
export const CONTROL_FONT_LOWER_COLOR: Rgba = { r: 0.65, g: 0.65, b: 0.65, a: 1 };

/** `control_font_hover_color` (`default_theme.cpp:104`). */
export const CONTROL_FONT_HOVER_COLOR: Rgba = { r: 0.95, g: 0.95, b: 0.95, a: 1 };

/** `control_font_focus_color` (`default_theme.cpp:105`): a focused Button's text, as bright as a hovered one's. */
export const CONTROL_FONT_FOCUS_COLOR: Rgba = { ...CONTROL_FONT_HOVER_COLOR };

/** `control_font_disabled_color`: {@link CONTROL_FONT_COLOR} at half alpha (`default_theme.cpp:106`). */
export const CONTROL_FONT_DISABLED_COLOR: Rgba = { ...CONTROL_FONT_COLOR, a: 0.5 };

/** `control_font_placeholder_color`: {@link CONTROL_FONT_COLOR} at 0.6 alpha (`default_theme.cpp:107`). */
export const CONTROL_FONT_PLACEHOLDER_COLOR: Rgba = { ...CONTROL_FONT_COLOR, a: 0.6 };

/** `control_font_pressed_color` (`default_theme.cpp:108`). */
export const CONTROL_FONT_PRESSED_COLOR: Rgba = { r: 1, g: 1, b: 1, a: 1 };

/** `Label`'s `font_color` (`default_theme.cpp:383`): opaque white. */
export const LABEL_FONT_COLOR: Rgba = { r: 1, g: 1, b: 1, a: 1 };

/** `default_font_size` = 16 (px). */
export const DEFAULT_FONT_SIZE = 16;

/**
 * The default flat-stylebox fill per draw state, the one transcription the canvas
 * renderer reads. Translucent, not pre-composited: Godot
 * blends them over the 2D clear colour, so `normal` over the default
 * `Color(0.3,0.3,0.3)` measures rgb(46,46,46).
 */
export const STYLE_FILL = {
  /** `style_normal_color`. Button/OptionButton/Panel "normal". */
  normal: { r: 0.1, g: 0.1, b: 0.1, a: 0.6 },
  /** `style_hover_color`. */
  hover: { r: 0.225, g: 0.225, b: 0.225, a: 0.6 },
  /** `style_pressed_color`. */
  pressed: { r: 0, g: 0, b: 0, a: 0.6 },
  /** `style_disabled_color`. */
  disabled: { r: 0.1, g: 0.1, b: 0.1, a: 0.3 },
  /** `style_popup_color`. PopupMenu / dropdown-list panel. */
  popup: { r: 0.25, g: 0.25, b: 0.25, a: 1 },
  /** `style_popup_hover_color`. An unfocused embedded window's border. */
  popupHover: { r: 0.4, g: 0.4, b: 0.4, a: 1 },
  /** `style_progress_color`. */
  progress: { r: 1, g: 1, b: 1, a: 0.4 },
  /** `style_hover_selected_color`. A hovered selected row of an ItemList or Tree. */
  hoverSelected: { r: 1, g: 1, b: 1, a: 0.4 },
  /** `style_selected_color`. The selected row of an ItemList, Tree or TabBar. */
  selected: { r: 1, g: 1, b: 1, a: 0.3 },
  /** `style_focus_color`. The outline of a focused Button. */
  focus: { r: 1, g: 1, b: 1, a: 0.75 },
} as const satisfies Record<string, Rgba>;

/** `default_corner_radius` = 3 (px): the corner radius of every default flat stylebox. */
export const DEFAULT_CORNER_RADIUS = 3;

/** `default_margin` = 4 (px): the Button "normal" stylebox content margin (all sides). */
export const DEFAULT_CONTENT_MARGIN = 4;

/** The 4 px spacing of the default theme's containers, before the theme scale. */
const DEFAULT_SEPARATION = 4;

/**
 * `style_line_edit->set_border_width(SIDE_BOTTOM, 2)` in default_theme.cpp, on the
 * LineEdit `normal`/`read_only` styleboxes. Set outside `make_flat_stylebox`, so
 * the theme scale never multiplies it: it stays 2px at `default_theme_scale = 2.0`.
 */
export const LINE_EDIT_BORDER_BOTTOM_WIDTH = 2;

/**
 * A character count, unscaled: `LineEdit::get_minimum_size()` multiplies it by the
 * 'W' advance (`font->get_char_size('W', font_size).x`) to floor the width, so the
 * scale reaches it through the font size. `em` stands in for the advance, a few
 * percent wide: the default font's 'W' is about 0.94em.
 */
export const LINE_EDIT_MINIMUM_CHARACTER_WIDTH = 4;

/**
 * The `slider_grabber` icon: a 16x16 box Godot positions, holding
 * a circle of radius 7. `generate_icon` rasterises through
 * `DPITexture::create_from_string(source, scale)`, so it scales with the theme.
 */
const SLIDER_GRABBER_SIZE = 16;

/**
 * `hslider_tick.svg`/`vslider_tick.svg` declare a 4x8 canvas, and the rasteriser
 * clips the path to it: `pnpm ref:godot` measures an 8px band. The tick box is 4px wide.
 */
const SLIDER_TICK_BOX = 4;

/** The default theme at a project's `gui/theme/default_theme_scale`. Every metric above is `scale = 1`. */
export interface ScaledGodotTheme {
  /** Unrounded, for a slice whose `default_theme.cpp` call site needs its own `Math.round(x * scale)`. */
  scale: number;
  /** `default_font_size` after scaling, in px. */
  fontSize: number;
  /** The containers' scaled 4 px spacing: a stand-in where a Control spaces its own internal rows (ItemList, TextEdit, ColorPicker, GraphEdit). */
  separation: number;
  /** The `slider_grabber` icon's box, in px. */
  sliderGrabberSize: number;
  /** The `tick` icon's box along the slider's main axis, in px. */
  sliderTickBox: number;
}

/** `Math::round(base * scale)`, the scale applied to one default-theme pixel value (`default_theme.cpp`). */
export function scaledPx(base: number, scale: number): number {
  return Math.round(base * scale);
}

/**
 * Godot builds the default theme once at startup and rounds each product on its
 * own (`fill_default_theme`, `make_flat_stylebox`), so at 1.5 the font is 24 and
 * the separation 6. A node's theme override is never scaled: callers use these
 * only as the fallback.
 */
export function scaledGodotTheme(scale: number): ScaledGodotTheme {
  // JS and Godot rounding differ only on negative halves, which the
  // [0.5, 8] clamp in `projectThemeScale` rules out.
  return {
    scale,
    fontSize: scaledPx(DEFAULT_FONT_SIZE, scale),
    // `Math::round(4 * scale)`, default_theme.cpp:1249-1251.
    separation: scaledPx(DEFAULT_SEPARATION, scale),
    sliderGrabberSize: scaledPx(SLIDER_GRABBER_SIZE, scale),
    sliderTickBox: scaledPx(SLIDER_TICK_BOX, scale),
  };
}
