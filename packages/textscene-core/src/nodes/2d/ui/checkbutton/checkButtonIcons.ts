/**
 * Godot default-theme SVG icons for the native (WebGL) CheckButton painter,
 * vendored as inline `data:` URLs — the CheckButton twin of
 * `r3f/controls/native/themeIcons.ts`'s `CHECK_BOX_ICONS`, kept in this
 * slice because that shared module is owned by the orchestrator.
 *
 * `scene/theme/default_theme.cpp:327-335` registers, per icon KEY (its SVG
 * filename without extension):
 *
 *   theme->set_icon("checked",            "CheckButton", icons["toggle_on"])
 *   theme->set_icon("checked_disabled",   "CheckButton", icons["toggle_on_disabled"])
 *   theme->set_icon("unchecked",          "CheckButton", icons["toggle_off"])
 *   theme->set_icon("unchecked_disabled", "CheckButton", icons["toggle_off_disabled"])
 *
 * plus four `_mirrored` variants (RTL, out of scope repo-wide) this module
 * does not vend.
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

/** `scene/theme/icons/toggle_on.svg` (32x16). */
const TOGGLE_ON_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjMwIiBoZWlnaHQ9IjE0IiB4PSIxIiB5PSIxIiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9Ii43NSIgcng9IjciLz48Y2lyY2xlIGN4PSIyNCIgY3k9IjgiIHI9IjUiIGZpbGw9IiMxYTFhMWEiLz48L3N2Zz4K';

/** `scene/theme/icons/toggle_off.svg` (32x16). */
const TOGGLE_OFF_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIxNiI+PGcgZmlsbC1vcGFjaXR5PSIuNSI+PHJlY3Qgd2lkdGg9IjMwIiBoZWlnaHQ9IjE0IiB4PSIxIiB5PSIxIiBmaWxsPSIjMWExYTFhIiByeD0iNyIvPjxjaXJjbGUgY3g9IjgiIGN5PSI4IiByPSI1IiBmaWxsPSIjZmZmIi8+PC9nPjwvc3ZnPgo=';

/** `scene/theme/icons/toggle_on_disabled.svg` (32x16). */
const TOGGLE_ON_DISABLED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjMwIiBoZWlnaHQ9IjE0IiB4PSIxIiB5PSIxIiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9Ii4zNyIgcng9IjciLz48Y2lyY2xlIGN4PSIyNCIgY3k9IjgiIHI9IjUiIGZpbGw9IiMxYTFhMWEiIGZpbGwtb3BhY2l0eT0iLjUiLz48L3N2Zz4K';

/** `scene/theme/icons/toggle_off_disabled.svg` (32x16). */
const TOGGLE_OFF_DISABLED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIxNiI+PGcgZmlsbC1vcGFjaXR5PSIuMjUiPjxyZWN0IHdpZHRoPSIzMCIgaGVpZ2h0PSIxNCIgeD0iMSIgeT0iMSIgZmlsbD0iIzFhMWExYSIgcng9IjciLz48Y2lyY2xlIGN4PSI4IiBjeT0iOCIgcj0iNSIgZmlsbD0iI2ZmZiIvPjwvZz48L3N2Zz4K';

/** CheckButton's four non-mirrored icon draw states — `default_theme.cpp:327-330`. */
export interface CheckButtonIcons {
  checked: string;
  checkedDisabled: string;
  unchecked: string;
  uncheckedDisabled: string;
}

export const CHECK_BUTTON_ICONS: CheckButtonIcons = {
  checked: svgDataUrl(TOGGLE_ON_B64),
  checkedDisabled: svgDataUrl(TOGGLE_ON_DISABLED_B64),
  unchecked: svgDataUrl(TOGGLE_OFF_B64),
  uncheckedDisabled: svgDataUrl(TOGGLE_OFF_DISABLED_B64),
};

/** Every vendored icon shares this authored size (`toggle_on.svg` et al, 32x16). */
export const CHECK_BUTTON_ICON_NATURAL_SIZE = { x: 32, y: 16 };
