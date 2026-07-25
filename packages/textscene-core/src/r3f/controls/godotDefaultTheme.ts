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
