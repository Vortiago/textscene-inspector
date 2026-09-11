/**
 * Godot default-theme SVG icons `ColorPickerButton` and `ColorPicker`'s
 * native (WebGL) painters need, vendored as inline `data:` URLs — the same
 * recipe `r3f/controls/native/themeIcons.ts` established for CheckBox/
 * OptionButton/SplitContainer (that file belongs to a different packet, so
 * these live here instead of alongside it).
 *
 * Godot bakes `scene/theme/icons/*.svg` into the default theme at build
 * time; each icon's theme key is its SVG filename without extension. Both
 * classes bind `"bg"`/`"overbright_indicator"` to the SAME two icons
 * (`scene/theme/default_theme.cpp:1098,1133`; ColorPicker's own
 * `"sample_bg"`/`"overbright_indicator"` at `:1096,1098`), and ColorPicker
 * alone additionally binds `"picker_cursor"`/`"picker_cursor_bg"` (`:1100-1101`).
 *
 * The bytes embedded below are unmodified copies of those SVG files from
 * Godot 4.6.3's `scene/theme/icons/`. Licence: Godot Engine, MIT — see
 * THIRD-PARTY-NOTICES.md.
 *
 * Base64 (not a raw/percent-encoded `data:` URL) so the exact source bytes
 * round-trip without needing to escape SVG's `<`, `"` and `#` characters.
 */

function svgDataUrl(base64: string): string {
  return `data:image/svg+xml;base64,${base64}`;
}

/** `scene/theme/icons/mini_checkerboard.svg` (16x16) — the alpha-preview tile. */
const MINI_CHECKERBOARD_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0iZ3JheSIgZD0iTTAgMHY4aDhWMHptOCA4djhoOFY4eiIvPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik04IDB2OGg4VjB6bTAgOEgwdjhoOHoiLz48L3N2Zz4K';

/** `scene/theme/icons/color_picker_overbright.svg` (16x16). */
const OVERBRIGHT_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjMDAwMDAzIiBkPSJtLjUuNXYxMGwxMC0xMHoiLz48L3N2Zz4K';

/** `scene/theme/icons/color_picker_cursor.svg` (12x12) — the SV-square cursor ring. */
const CURSOR_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiI+PGNpcmNsZSBjeD0iNiIgY3k9IjYiIHI9IjUiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIvPjxjaXJjbGUgY3g9IjYiIGN5PSI2IiByPSI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAiLz48L3N2Zz4K';

/** `scene/theme/icons/color_picker_cursor_bg.svg` (12x12) — the cursor's own-colour fill. */
const CURSOR_BG_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiI+PGNpcmNsZSBjeD0iNiIgY3k9IjYiIHI9IjQiIGZpbGw9IiNmZmYiLz48L3N2Zz4K';

export const MINI_CHECKERBOARD_ICON = svgDataUrl(MINI_CHECKERBOARD_B64);
export const COLOR_PICKER_OVERBRIGHT_ICON = svgDataUrl(OVERBRIGHT_B64);
export const COLOR_PICKER_CURSOR_ICON = svgDataUrl(CURSOR_B64);
export const COLOR_PICKER_CURSOR_BG_ICON = svgDataUrl(CURSOR_BG_B64);

/** The checkerboard tile's own natural size — both SVGs above are 16x16. */
export const MINI_CHECKERBOARD_SIZE = 16;

/** The cursor icons' own natural size — both SVGs above are 12x12. */
export const COLOR_PICKER_CURSOR_SIZE = 12;

/**
 * `is_color_overbright` (`scene/gui/color_picker.cpp:56-58`): any channel
 * past 1 — an HDR colour this engine's own single sRGB→linear conversion
 * cannot preview accurately, so both classes draw a warning glyph over it.
 */
export function isColorOverbright(color: { r: number; g: number; b: number }): boolean {
  return color.r > 1 || color.g > 1 || color.b > 1;
}
