/**
 * Godot 4.6.3's default theme (`fill_default_theme`, `scene/theme/default_theme.cpp`): the font colours,
 * the flat stylebox fills and the metrics a Control draws with when no theme overrides them.
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
  /** `style_progress_color`. */
  progress: { r: 1, g: 1, b: 1, a: 0.4 },
} as const satisfies Record<string, Rgba>;

/** `default_corner_radius` = 3 (px): the corner radius of every default flat stylebox. */
const DEFAULT_CORNER_RADIUS = 3;

/** `default_margin` = 4 (px): the Button "normal" stylebox content margin (all sides). */
export const DEFAULT_CONTENT_MARGIN = 4;

/** BoxContainer `separation` and GridContainer `h_/v_separation` = 4 (px). */
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
 * The `slider` and `grabber_area` styleboxes are `make_flat_stylebox(color, 4, 4, 4, 4, 4)`.
 * `StyleBox::get_minimum_size()` sums opposing margins, so the track is 8px thick:
 * the `widget_height`/`widget_width` that `Slider::_notification(NOTIFICATION_DRAW)` reads.
 */
const SLIDER_STYLE_MARGIN = 4;
const SLIDER_CORNER_RADIUS = 4;

/**
 * The `slider_grabber` icon: a 16x16 box Godot positions, holding
 * `<circle cx="8" cy="8" r="7" fill="#fefefe" fill-opacity=".75"/>`. `generate_icon` rasterises through
 * `DPITexture::create_from_string(source, scale)`, so it scales with the theme.
 */
const SLIDER_GRABBER_SIZE = 16;
const SLIDER_GRABBER_RADIUS = 7;

/**
 * `hslider_tick.svg`/`vslider_tick.svg` declare a 4x8 canvas, and the rasteriser
 * clips the path to it: `pnpm ref:godot` measures an 8px band. A tick is a 2px bar
 * across the 8px track, centred in a 4px-wide box.
 */
const SLIDER_TICK_BOX = 4;
const SLIDER_TICK_THICKNESS = 2;

/** The default theme at a project's `gui/theme/default_theme_scale`. Every metric above is `scale = 1`. */
export interface ScaledGodotTheme {
  /** Unrounded, for a slice whose `default_theme.cpp` call site needs its own `Math.round(x * scale)`. */
  scale: number;
  /** `default_font_size` after scaling, in px. */
  fontSize: number;
  /** Every default flat stylebox's corner radius, in px. */
  cornerRadius: number;
  /** The Button "normal" stylebox content margin (all sides), in px. */
  contentMargin: number;
  /** OptionButton "normal" horizontal content margin, in px. */
  optionButtonMarginX: number;
  /** OptionButton "normal" vertical content margin, in px. */
  optionButtonMarginY: number;
  /** BoxContainer `separation` / GridContainer `h_/v_separation`, in px. */
  separation: number;
  /** The sliders' `slider`/`grabber_area` stylebox thickness, in px. */
  sliderTrackThickness: number;
  /** Those styleboxes' corner radius, in px. */
  sliderCornerRadius: number;
  /** The `slider_grabber` icon's box, in px. */
  sliderGrabberSize: number;
  /** The circle drawn inside that box, in px. */
  sliderGrabberRadius: number;
  /** The `tick` icon's box along the slider's main axis, in px. */
  sliderTickBox: number;
  /** The visible tick bar's thickness, in px. */
  sliderTickThickness: number;
}

/**
 * Godot builds the default theme once at startup and rounds each product on its
 * own (`fill_default_theme`, `make_flat_stylebox`), so at 1.5 the font is 24 and
 * the corner radius 5. A node's theme override is never scaled: callers use these
 * only as the fallback.
 */
export function scaledGodotTheme(scale: number): ScaledGodotTheme {
  // JS and Godot rounding differ only on negative halves, which the
  // [0.5, 8] clamp in `projectThemeScale` rules out.
  const contentMargin = Math.round(DEFAULT_CONTENT_MARGIN * scale);
  return {
    scale,
    fontSize: Math.round(DEFAULT_FONT_SIZE * scale),
    cornerRadius: Math.round(DEFAULT_CORNER_RADIUS * scale),
    contentMargin,
    // The OptionButton styleboxes take `2 * default_margin` across and `default_margin`
    // down (`default_theme.cpp:215`).
    optionButtonMarginX: Math.round(2 * DEFAULT_CONTENT_MARGIN * scale),
    optionButtonMarginY: contentMargin,
    // `Math::round(4 * scale)`, default_theme.cpp:1249-1251.
    separation: Math.round(DEFAULT_SEPARATION * scale),
    // Twice a rounded margin, not the rounding of twice the margin: the two
    // diverge at any scale whose margin lands on a half.
    sliderTrackThickness: 2 * Math.round(SLIDER_STYLE_MARGIN * scale),
    sliderCornerRadius: Math.round(SLIDER_CORNER_RADIUS * scale),
    sliderGrabberSize: Math.round(SLIDER_GRABBER_SIZE * scale),
    sliderGrabberRadius: Math.round(SLIDER_GRABBER_RADIUS * scale),
    sliderTickBox: Math.round(SLIDER_TICK_BOX * scale),
    sliderTickThickness: Math.round(SLIDER_TICK_THICKNESS * scale),
  };
}
