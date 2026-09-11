/**
 * Godot 4.6 `default_theme` constants. Each value is transcribed from Godot's
 * `scene/theme/default_theme.cpp` so a Control's un-themed chrome matches what
 * the engine paints for the built-in dark UI theme, instead of a hand-picked
 * approximation that drifts from it.
 *
 * The fills are the engine's SEMI-TRANSPARENT StyleBoxFlat colours (e.g.
 * `Color(0.1, 0.1, 0.1, 0.6)`) — kept translucent, not pre-composited — so they
 * blend over the canvas background exactly as Godot blends them over the 2D
 * clear colour. Measured against real Godot renders: a `Color(0.1,0.1,0.1,0.6)`
 * fill over Godot's default `Color(0.3,0.3,0.3)` clear composites to
 * rgb(46,46,46).
 *
 * Framework-free (plain strings/numbers, no React import) so both the
 * render-side components and any `.ts`-only consumer can read the constants;
 * `native/nativeTheme.ts` builds `NativeTheme` on top of `scaledGodotTheme`
 * without re-transcribing any of them.
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
 * The default flat-stylebox fill per draw state, as Godot's own `Color`
 * literals. These are the ground truth: the CSS strings below are formatted
 * from them, and the native canvas renderer reads the same numbers to build a
 * material colour. Two independent transcriptions of `default_theme.cpp` would
 * let a corrected constant land on one renderer and not the other, which shows
 * up as nothing failing and the two paths quietly disagreeing.
 *
 * Kept deliberately translucent rather than pre-composited: Godot blends these
 * over whatever the 2D viewport cleared to, so the renderer must too.
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

/**
 * `control_font_placeholder_color` = `Color(control_font_color.rgb, 0.6)` — the
 * LineEdit placeholder. Same RGB as DEFAULT_FONT_COLOR, alpha 0.6.
 */
export const CONTROL_FONT_PLACEHOLDER_COLOR = 'rgba(223, 223, 223, 0.6)';

/**
 * `control_font_disabled_color` = `control_font_color * Color(1, 1, 1, 0.5)` —
 * LineEdit's `font_uneditable_color`. Same RGB, alpha 0.5.
 */
export const CONTROL_FONT_DISABLED_COLOR = 'rgba(223, 223, 223, 0.5)';

// --- LineEdit ---

/**
 * The LineEdit `normal`/`read_only` styleboxes are plain flat boxes with a
 * 2px bottom border — `style_line_edit->set_border_width(SIDE_BOTTOM, 2)`,
 * commented in default_theme.cpp as what makes "LineEdits distinguishable from
 * Buttons". `normal` borders in `style_pressed_color`; `read_only` in
 * `style_pressed_color * Color(1, 1, 1, 0.5)` → Color(0, 0, 0, 0.3).
 *
 * Set directly on the stylebox rather than through `make_flat_stylebox`, so
 * unlike every margin and radius around it this one is NOT multiplied by the
 * theme scale — it stays 2px in a `default_theme_scale = 2.0` project.
 */
export const LINE_EDIT_BORDER_BOTTOM_WIDTH = 2;
export const LINE_EDIT_READ_ONLY_BORDER_COLOR = 'rgba(0, 0, 0, 0.3)';

/**
 * `minimum_character_width` = 4. `LineEdit::get_minimum_size()` multiplies it by
 * the font's 'W' advance — `font->get_char_size('W', font_size).x`, chosen over
 * 'M' because "W is wider than M in most fonts" — to floor the field's WIDTH
 * (not its height). CSS has no unit for a specific glyph's advance; `em` stands
 * in, which for the default font runs a few percent wide since its 'W' advance
 * is about 0.94em.
 *
 * A character COUNT, not a length: `default_theme.cpp` sets it without the
 * `* scale` every neighbouring constant carries, because the scale reaches it
 * through the font size it multiplies. `em` reproduces that for free.
 */
export const LINE_EDIT_MINIMUM_CHARACTER_WIDTH = 4;

// --- HSlider / VSlider ---

/**
 * The `slider` and `grabber_area` styleboxes are
 * `make_flat_stylebox(color, 4, 4, 4, 4, 4)` — 4px content margins all round
 * and a 4px corner radius. `StyleBox::get_minimum_size()` sums the opposing
 * margins, so the track is 4 + 4 = 8px thick on its cross axis, which is what
 * `Slider::_notification(NOTIFICATION_DRAW)` reads as `widget_height` /
 * `widget_width`.
 */
export const SLIDER_STYLE_MARGIN = 4;
export const SLIDER_TRACK_THICKNESS = 2 * SLIDER_STYLE_MARGIN;
export const SLIDER_CORNER_RADIUS = 4;

/**
 * The grabber is the `slider_grabber` icon, not a stylebox: a 16x16 texture
 * holding `<circle cx="8" cy="8" r="7" fill="#fefefe" fill-opacity=".75"/>`.
 * The 16px box is the rect Godot's placement math positions; the circle inside
 * it has radius 7, so it leaves a 1px transparent margin.
 * `slider_grabber_disabled` is the same circle at opacity 0.37.
 *
 * Icons scale with the theme too — `generate_icon` rasterises each SVG through
 * `DPITexture::create_from_string(source, scale)` — so the grabber grows with
 * the styleboxes rather than staying 16px against a thicker track.
 */
export const SLIDER_GRABBER_SIZE = 16;
export const SLIDER_GRABBER_RADIUS = 7;
export const SLIDER_GRABBER_FILL = 'rgba(254, 254, 254, 0.75)';
export const SLIDER_GRABBER_DISABLED_FILL = 'rgba(254, 254, 254, 0.37)';

/**
 * `hslider_tick.svg`/`vslider_tick.svg` declare a 4x8 canvas (`width="4"
 * height="8"` / `width="8" height="4"`); the path inside draws past that, but
 * Godot's SVG rasteriser clips to the declared canvas — measured directly off
 * real Godot 4.6.3 (`pnpm ref:godot`, a probe scene with `tick_count` set):
 * the painted tick band is exactly 8px. So a tick is a 2px bar spanning 8px
 * across the 8px track, centred in a 4px-wide texture box.
 */
export const SLIDER_TICK_BOX = 4;
export const SLIDER_TICK_THICKNESS = 2;

// --- Project theme scale (gui/theme/default_theme_scale) ---

/**
 * The scale-dependent half of the default theme. Every metric above is the
 * `scale = 1` case; a project that sets `gui/theme/default_theme_scale` gets
 * these instead.
 */
export interface ScaledGodotTheme {
  /**
   * The raw project `gui/theme/default_theme_scale`, unrounded — for a slice
   * whose own `default_theme.cpp` call site needs a `Math.round(x * scale)`
   * term this struct does not already expose pre-rounded.
   */
  scale: number;
  /** `default_font_size` after scaling — the theme's default font size in px. */
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
 * The default theme's metrics at a project's `gui/theme/default_theme_scale`.
 *
 * Godot builds its default theme ONCE at startup from that scale rather than
 * scaling at draw time, and it rounds each product independently —
 * `scene/theme/default_theme.cpp`, `fill_default_theme`:
 *
 *     theme->set_default_font_size(Math::round(default_font_size * scale));
 *
 * and in `make_flat_stylebox`:
 *
 *     style->set_content_margin_individual(Math::round(p_margin_left * scale), …);
 *     style->set_corner_radius_all(Math::round(p_corner_radius * scale));
 *
 * and for the box containers (`default_theme.cpp:1249-1251`):
 *
 *     theme->set_constant("separation", "BoxContainer", Math::round(4 * scale));
 *
 * Rounding therefore happens per metric, never once on the scale — at 1.5 the
 * font is round(16·1.5) = 24 while the corner radius is round(3·1.5) = 5, which
 * a single pre-rounded scale could not produce. JS `Math.round` and Godot's
 * `Math::round` differ only on negative halves, which the caller's clamp to
 * [0.5, 8] (see `projectThemeScale`) cannot produce.
 *
 * A theme OVERRIDE on a node (`theme_override_constants/separation = 13`) is
 * not scaled: Godot returns an override verbatim, so it stays the px the scene
 * declares. Callers keep the override-wins shape and use these only as the
 * fallback.
 */
export function scaledGodotTheme(scale: number): ScaledGodotTheme {
  const contentMargin = Math.round(DEFAULT_CONTENT_MARGIN * scale);
  return {
    scale,
    fontSize: Math.round(DEFAULT_FONT_SIZE * scale),
    cornerRadius: Math.round(DEFAULT_CORNER_RADIUS * scale),
    contentMargin,
    optionButtonMarginX: Math.round(2 * DEFAULT_CONTENT_MARGIN * scale),
    optionButtonMarginY: contentMargin,
    separation: Math.round(DEFAULT_SEPARATION * scale),
    // The track's thickness is the stylebox's two opposing content margins, so
    // it is twice a ROUNDED margin — not the rounding of twice the margin. The
    // two diverge at any scale whose margin lands on a half.
    sliderTrackThickness: 2 * Math.round(SLIDER_STYLE_MARGIN * scale),
    sliderCornerRadius: Math.round(SLIDER_CORNER_RADIUS * scale),
    sliderGrabberSize: Math.round(SLIDER_GRABBER_SIZE * scale),
    sliderGrabberRadius: Math.round(SLIDER_GRABBER_RADIUS * scale),
    sliderTickBox: Math.round(SLIDER_TICK_BOX * scale),
    sliderTickThickness: Math.round(SLIDER_TICK_THICKNESS * scale),
  };
}
