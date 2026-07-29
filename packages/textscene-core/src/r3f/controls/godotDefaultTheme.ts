/**
 * Godot 4.6 `default_theme` constants shared by the DOM-overlay Controls
 * (ADR-0003). Each value is transcribed from Godot's
 * `scene/theme/default_theme.cpp` and rendered to CSS so a Control's un-themed
 * chrome matches what the engine paints for the built-in dark UI theme, instead
 * of a hand-picked approximation that drifts from it.
 *
 * The fills are the engine's SEMI-TRANSPARENT StyleBoxFlat colours (e.g.
 * `Color(0.1, 0.1, 0.1, 0.6)`) — kept translucent, not pre-composited — so they
 * blend over the overlay background exactly as Godot blends them over the 2D
 * clear colour. Measured against real Godot renders: a `Color(0.1,0.1,0.1,0.6)`
 * fill over Godot's default `Color(0.3,0.3,0.3)` clear composites to
 * rgb(46,46,46), which the overlay reproduces because it shares that backdrop.
 *
 * Framework-free (plain strings/numbers, no React import) so both the
 * render-side components and any `.ts`-only consumer can read the constants;
 * each Control composes its own CSSProperties from them.
 */

// --- Text (control_font_color / default_font_size) ---

/** `default_font_color` = Color(0.875, 0.875, 0.875) → round(0.875·255) = 223 → #dfdfdf. */
export const DEFAULT_FONT_COLOR = 'rgb(223, 223, 223)';

/** `default_font_size` = 16 (px). */
export const DEFAULT_FONT_SIZE = 16;

// --- StyleBoxFlat fills (button / dropdown / panel chrome), by draw state ---

/** `style_normal_color` = Color(0.1, 0.1, 0.1, 0.6). Button/OptionButton/Panel "normal". */
export const STYLE_NORMAL_FILL = 'rgba(26, 26, 26, 0.6)';

/** `style_hover_color` = Color(0.225, 0.225, 0.225, 0.6). */
export const STYLE_HOVER_FILL = 'rgba(57, 57, 57, 0.6)';

/** `style_pressed_color` = Color(0, 0, 0, 0.6). */
export const STYLE_PRESSED_FILL = 'rgba(0, 0, 0, 0.6)';

/** `style_disabled_color` = Color(0.1, 0.1, 0.1, 0.3). */
export const STYLE_DISABLED_FILL = 'rgba(26, 26, 26, 0.3)';

/** `style_popup_color` = Color(0.25, 0.25, 0.25, 1). PopupMenu / dropdown-list panel. */
export const STYLE_POPUP_FILL = 'rgba(64, 64, 64, 1)';

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

// --- Project theme scale (gui/theme/default_theme_scale) ---

/**
 * The scale-dependent half of the default theme. Every metric above is the
 * `scale = 1` case; a project that sets `gui/theme/default_theme_scale` gets
 * these instead.
 */
export interface ScaledGodotTheme {
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
    fontSize: Math.round(DEFAULT_FONT_SIZE * scale),
    cornerRadius: Math.round(DEFAULT_CORNER_RADIUS * scale),
    contentMargin,
    optionButtonMarginX: Math.round(2 * DEFAULT_CONTENT_MARGIN * scale),
    optionButtonMarginY: contentMargin,
    separation: Math.round(DEFAULT_SEPARATION * scale),
  };
}
