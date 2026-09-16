/**
 * LineEdit's own vendored default-theme icon — `scene/theme/icons/line_edit_clear.svg`
 * (Godot 4.6.3, MIT), the `"clear"` theme icon (`default_theme.cpp:436`).
 * `native/themeIcons.ts` is out of bounds for this slice to extend, and its
 * `svgDataUrl` helper is not exported, so both are kept local here —
 * `spinbox/icons.ts` is the pattern this follows.
 *
 * Licence: Godot Engine, MIT — see THIRD-PARTY-NOTICES.md.
 */

function svgDataUrl(base64: string): string {
  return `data:image/svg+xml;base64,${base64}`;
}

/** `scene/theme/icons/line_edit_clear.svg` (16x16). */
const LINE_EDIT_CLEAR_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIuNzUiIGQ9Im0xIDMgMi0yIDUgNSA1LTUgMiAyLTUgNSA1IDUtMiAyLTUtNS01IDUtMi0yIDUtNXoiLz48L3N2Zz4K';

/** LineEdit's `clear` theme icon (`default_theme.cpp:436`). */
export const LINE_EDIT_CLEAR_ICON = svgDataUrl(LINE_EDIT_CLEAR_B64);

/** The vendored icon's own authored size — Godot's default theme registers no other. */
export const LINE_EDIT_CLEAR_ICON_NATURAL_SIZE = { x: 16, y: 16 };
