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

/** `control_font_focus_color` (`default_theme.cpp:105`): a focused Button's text, as bright as a hovered one's. */
export const CONTROL_FONT_FOCUS_COLOR: Rgba = { ...CONTROL_FONT_HOVER_COLOR };

/** `control_font_disabled_color`: {@link CONTROL_FONT_COLOR} at half alpha (`default_theme.cpp:106`). */
export const CONTROL_FONT_DISABLED_COLOR: Rgba = { ...CONTROL_FONT_COLOR, a: 0.5 };

/** `control_font_placeholder_color`: {@link CONTROL_FONT_COLOR} at 0.6 alpha (`default_theme.cpp:107`). */
export const CONTROL_FONT_PLACEHOLDER_COLOR: Rgba = { ...CONTROL_FONT_COLOR, a: 0.6 };

/** `control_font_pressed_color` (`default_theme.cpp:108`). */
export const CONTROL_FONT_PRESSED_COLOR: Rgba = { r: 1, g: 1, b: 1, a: 1 };

/** `default_font_size` = 16 (px). */
export const DEFAULT_FONT_SIZE = 16;

/**
 * What the default theme adds to the default font size for each Label variation (`default_theme.cpp:394-401`).
 * The sum is the unscaled `DEFAULT_FONT_SIZE` plus the step, so it ignores the theme scale.
 */
export const DEFAULT_THEME_VARIATION_FONT_SIZE_STEPS: Readonly<Record<string, number>> = {
  HeaderSmall: 4,
  HeaderMedium: 8,
  HeaderLarge: 12,
};

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
  /** `style_focus_color`. The outline of a focused Button. */
  focus: { r: 1, g: 1, b: 1, a: 0.75 },
} as const satisfies Record<string, Rgba>;

/** `default_corner_radius` = 3 (px): the corner radius of every default flat stylebox. */
export const DEFAULT_CORNER_RADIUS = 3;

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
 * the corner radius 5. A node's theme override is never scaled: callers use these
 * only as the fallback.
 */
export function scaledGodotTheme(scale: number): ScaledGodotTheme {
  // JS and Godot rounding differ only on negative halves, which the
  // [0.5, 8] clamp in `projectThemeScale` rules out.
  const contentMargin = scaledPx(DEFAULT_CONTENT_MARGIN, scale);
  return {
    scale,
    fontSize: scaledPx(DEFAULT_FONT_SIZE, scale),
    cornerRadius: scaledPx(DEFAULT_CORNER_RADIUS, scale),
    contentMargin,
    // The OptionButton styleboxes take `2 * default_margin` across and `default_margin`
    // down (`default_theme.cpp:215`).
    optionButtonMarginX: scaledPx(2 * DEFAULT_CONTENT_MARGIN, scale),
    optionButtonMarginY: contentMargin,
    // `Math::round(4 * scale)`, default_theme.cpp:1249-1251.
    separation: scaledPx(DEFAULT_SEPARATION, scale),
    // Twice a rounded margin, not the rounding of twice the margin: the two
    // diverge at any scale whose margin lands on a half.
    sliderTrackThickness: 2 * scaledPx(SLIDER_STYLE_MARGIN, scale),
    sliderCornerRadius: scaledPx(SLIDER_CORNER_RADIUS, scale),
    sliderGrabberSize: scaledPx(SLIDER_GRABBER_SIZE, scale),
    sliderTickBox: scaledPx(SLIDER_TICK_BOX, scale),
  };
}

/** The variation the picker's `btn_shape`, `btn_mode` and `menu_btn` name (`color_picker.cpp:2098,2148,2255`). */
export const FLAT_MENU_BUTTON_VARIATION = 'FlatMenuButton';

/**
 * The type variations the default theme registers, each with its base (`default_theme.cpp:357-358`,
 * `:394-400`, `:814`, `:845`, `:1167-1171`). A Theme that sets items for one of them is read for a
 * Control that names it, though no scene Theme registers it.
 */
export const DEFAULT_THEME_TYPE_VARIATIONS: Readonly<Record<string, string>> = {
  FlatButton: 'Button',
  [FLAT_MENU_BUTTON_VARIATION]: 'MenuButton',
  HeaderSmall: 'Label',
  HeaderMedium: 'Label',
  HeaderLarge: 'Label',
  GraphNodeTitleLabel: 'Label',
  GraphFrameTitleLabel: 'Label',
  TooltipPanel: 'PopupPanel',
  TooltipLabel: 'Label',
};
