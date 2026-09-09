/**
 * Godot's own numbers for what a Control subtree rasterises to. Every one is
 * traced to the engine line that produces it, because these are what make the
 * suites parity assertions rather than smoke tests.
 */

/**
 * Godot's viewport clear colour behind a Control subtree:
 * `main/main.cpp` — `GLOBAL_DEF_BASIC("rendering/environment/defaults/default_clear_color",
 * Color(0.3, 0.3, 0.3))`, selected by `servers/rendering/renderer_viewport.cpp`
 * (`transparent_bg ? Color(0,0,0,0) : get_default_clear_color()`) and quantised
 * by `Color::to_rgba32()` (`core/math/color.cpp`), which uses
 * `Math::round(0.3 * 255) = 77`.
 */
export const GODOT_CLEAR_RGB = [77, 77, 77];

/**
 * `default_theme.cpp` sets `control_font_color` = Color(0.875, …) →
 * round(0.875·255) = 223, which `godotDefaultTheme.ts` mirrors as
 * `DEFAULT_FONT_COLOR = 'rgb(223, 223, 223)'`. Label glyphs land on that value;
 * antialiasing only blends it DOWNWARD toward the backdrop, which is what makes
 * it separable from the checkerboard's #ffffff below.
 */
export const GODOT_FONT_RGB = [223, 223, 223];
