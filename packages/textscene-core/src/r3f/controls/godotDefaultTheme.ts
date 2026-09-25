/**
 * Godot 4.6 default-theme constants, transcribed from `scene/theme/default_theme.cpp`,
 * so a Control's un-themed chrome matches the engine's dark UI theme. No React
 * import: `.ts`-only consumers read them, and `native/nativeTheme.ts` builds on
 * `scaledGodotTheme`.
 */

// --- Text (control_font_color / default_font_size) ---

/** `default_font_color` = Color(0.875, 0.875, 0.875) → round(0.875·255) = 223 → #dfdfdf. */
export const DEFAULT_FONT_COLOR = 'rgb(223, 223, 223)';

/** `default_font_size` = 16 (px). */
export const DEFAULT_FONT_SIZE = 16;

// --- StyleBoxFlat fills (button / dropdown / panel chrome), by draw state ---

/** A `Color` as `default_theme.cpp` writes it: linear-ish 0..1 channels. */
export interface ThemeFill {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * The default flat-stylebox fill per draw state, the one transcription both the
 * CSS strings and the canvas renderer read. Translucent, not pre-composited: Godot
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
} as const satisfies Record<string, ThemeFill>;

/**
 * Formats a {@link ThemeFill} as CSS. A local three-liner on purpose: this
 * module's contract is to stay importable by `.ts`-only consumers, so it never
 * value-imports the colour/vector parsers a shared formatter would drag in.
 */
const fillCss = (c: ThemeFill): string =>
  `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;

export const STYLE_NORMAL_FILL = fillCss(STYLE_FILL.normal);
export const STYLE_HOVER_FILL = fillCss(STYLE_FILL.hover);
export const STYLE_PRESSED_FILL = fillCss(STYLE_FILL.pressed);
export const STYLE_DISABLED_FILL = fillCss(STYLE_FILL.disabled);
export const STYLE_POPUP_FILL = fillCss(STYLE_FILL.popup);

// --- Flat-stylebox geometry (make_flat_stylebox defaults) ---

/** `default_corner_radius` = 3 (px): the corner radius of every default flat stylebox. */
export const DEFAULT_CORNER_RADIUS = 3;

/** `default_margin` = 4 (px): the Button "normal" stylebox content margin (all sides). */
export const DEFAULT_CONTENT_MARGIN = 4;

/**
 * OptionButton "normal" stylebox uses `2 * default_margin` horizontally and
 * `default_margin` vertically → 8px left/right, 4px top/bottom.
 */
export const OPTION_BUTTON_CONTENT_MARGIN_X = 2 * DEFAULT_CONTENT_MARGIN;
export const OPTION_BUTTON_CONTENT_MARGIN_Y = DEFAULT_CONTENT_MARGIN;

/** BoxContainer `separation` and GridContainer `h_/v_separation` = 4 (px). */
export const DEFAULT_SEPARATION = 4;

/** `style_progress_color` = Color(1, 1, 1, 0.4). The sliders' filled `grabber_area`. */
export const STYLE_PROGRESS_FILL = 'rgba(255, 255, 255, 0.4)';

// --- Derived font colours (control_font_color modulated per draw state) ---

/** `control_font_placeholder_color` = `Color(control_font_color.rgb, 0.6)`: the LineEdit placeholder. */
export const CONTROL_FONT_PLACEHOLDER_COLOR = 'rgba(223, 223, 223, 0.6)';

/** `control_font_disabled_color` = `control_font_color * Color(1, 1, 1, 0.5)`: LineEdit's `font_uneditable_color`. */
export const CONTROL_FONT_DISABLED_COLOR = 'rgba(223, 223, 223, 0.5)';

// --- LineEdit ---

/**
 * `style_line_edit->set_border_width(SIDE_BOTTOM, 2)` in default_theme.cpp, on the
 * LineEdit `normal`/`read_only` styleboxes. Set outside `make_flat_stylebox`, so
 * the theme scale never multiplies it: it stays 2px at `default_theme_scale = 2.0`.
 */
export const LINE_EDIT_BORDER_BOTTOM_WIDTH = 2;
/** `normal` borders in `style_pressed_color`, `read_only` in that times `Color(1, 1, 1, 0.5)`. */
export const LINE_EDIT_READ_ONLY_BORDER_COLOR = 'rgba(0, 0, 0, 0.3)';

/**
 * A character count, unscaled: `LineEdit::get_minimum_size()` multiplies it by the
 * 'W' advance (`font->get_char_size('W', font_size).x`) to floor the width, so the
 * scale reaches it through the font size. `em` stands in for the advance, a few
 * percent wide: the default font's 'W' is about 0.94em.
 */
export const LINE_EDIT_MINIMUM_CHARACTER_WIDTH = 4;

// --- HSlider / VSlider ---

/**
 * The `slider` and `grabber_area` styleboxes are `make_flat_stylebox(color, 4, 4, 4, 4, 4)`.
 * `StyleBox::get_minimum_size()` sums opposing margins, so the track is 8px thick:
 * the `widget_height`/`widget_width` that `Slider::_notification(NOTIFICATION_DRAW)` reads.
 */
export const SLIDER_STYLE_MARGIN = 4;
export const SLIDER_TRACK_THICKNESS = 2 * SLIDER_STYLE_MARGIN;
export const SLIDER_CORNER_RADIUS = 4;

/**
 * The `slider_grabber` icon: a 16x16 box Godot positions, holding
 * `<circle cx="8" cy="8" r="7" fill="#fefefe" fill-opacity=".75"/>`. Disabled is
 * opacity 0.37. `generate_icon` rasterises through
 * `DPITexture::create_from_string(source, scale)`, so it scales with the theme.
 */
export const SLIDER_GRABBER_SIZE = 16;
export const SLIDER_GRABBER_RADIUS = 7;
export const SLIDER_GRABBER_FILL = 'rgba(254, 254, 254, 0.75)';
export const SLIDER_GRABBER_DISABLED_FILL = 'rgba(254, 254, 254, 0.37)';

/**
 * `hslider_tick.svg`/`vslider_tick.svg` declare a 4x8 canvas, and the rasteriser
 * clips the path to it: `pnpm ref:godot` measures an 8px band. A tick is a 2px bar
 * across the 8px track, centred in a 4px-wide box.
 */
export const SLIDER_TICK_BOX = 4;
export const SLIDER_TICK_THICKNESS = 2;

// --- Project theme scale (gui/theme/default_theme_scale) ---

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
