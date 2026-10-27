/**
 * LineEdit's vendored default-theme `"clear"` icon, `scene/theme/icons/line_edit_clear.svg`
 * (Godot 4.6.3, `default_theme.cpp:436`).
 *
 * Licence: Godot Engine, MIT. See THIRD-PARTY-NOTICES.md.
 */

import { svgDataUrl } from '../../../../r3f/controls/native/themeIcons';

/** `scene/theme/icons/line_edit_clear.svg` (16x16). */
const LINE_EDIT_CLEAR_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIuNzUiIGQ9Im0xIDMgMi0yIDUgNSA1LTUgMiAyLTUgNSA1IDUtMiAyLTUtNS01IDUtMi0yIDUtNXoiLz48L3N2Zz4K';

/** LineEdit's `clear` theme icon (`default_theme.cpp:436`). */
export const LINE_EDIT_CLEAR_ICON = svgDataUrl(LINE_EDIT_CLEAR_B64);

/** The vendored icon's authored size. Godot's default theme registers no other. */
export const LINE_EDIT_CLEAR_ICON_NATURAL_SIZE = { x: 16, y: 16 };
