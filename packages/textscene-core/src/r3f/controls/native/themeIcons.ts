/**
 * Godot default-theme SVG icons that the native (WebGL) CheckBox and
 * OptionButton Control painters need, vendored as inline `data:` URLs.
 *
 * Godot bakes `scene/theme/icons/*.svg` into the default theme at build
 * time — see `scene/theme/icons/default_theme_icons_builders.py`
 * (`make_default_theme_icons_action`): each icon's THEME KEY is simply its
 * SVG filename without extension (e.g. `checked.svg` -> `icons["checked"]`),
 * and `scene/theme/default_theme.cpp` registers those keys per control:
 *
 *  - CheckBox (`default_theme.cpp:288-295`):
 *      set_icon("checked",                 "CheckBox", icons["checked"])
 *      set_icon("checked_disabled",        "CheckBox", icons["checked_disabled"])
 *      set_icon("unchecked",               "CheckBox", icons["unchecked"])
 *      set_icon("unchecked_disabled",      "CheckBox", icons["unchecked_disabled"])
 *      set_icon("radio_checked",           "CheckBox", icons["radio_checked"])
 *      set_icon("radio_checked_disabled",  "CheckBox", icons["radio_checked_disabled"])
 *      set_icon("radio_unchecked",         "CheckBox", icons["radio_unchecked"])
 *      set_icon("radio_unchecked_disabled","CheckBox", icons["radio_unchecked_disabled"])
 *  - OptionButton (`default_theme.cpp:235`):
 *      set_icon("arrow", "OptionButton", icons["option_button_arrow"])
 *  - SplitContainer family (`default_theme.cpp:1244-1247`):
 *      set_icon("h_grabber", "SplitContainer", icons["hsplitter"])
 *      set_icon("v_grabber", "SplitContainer", icons["vsplitter"])
 *      set_icon("grabber",   "HSplitContainer", icons["hsplitter"])
 *      set_icon("grabber",   "VSplitContainer", icons["vsplitter"])
 *  - HSlider / VSlider (`default_theme.cpp:589-592,604-607`), IDENTICAL for
 *    both orientations except the `tick` icon:
 *      set_icon("grabber",           "HSlider", icons["slider_grabber"])
 *      set_icon("grabber_highlight", "HSlider", icons["slider_grabber_hl"])
 *      set_icon("grabber_disabled",  "HSlider", icons["slider_grabber_disabled"])
 *      set_icon("tick",              "HSlider", icons["hslider_tick"])
 *      set_icon("grabber",           "VSlider", icons["slider_grabber"])
 *      set_icon("grabber_highlight", "VSlider", icons["slider_grabber_hl"])
 *      set_icon("grabber_disabled",  "VSlider", icons["slider_grabber_disabled"])
 *      set_icon("tick",              "VSlider", icons["vslider_tick"])
 *    `grabber_highlight` is Slider's hover/focus state — out of scope for a
 *    static previewer (same restriction as Button's hover/pressed states), so
 *    it is not vended here; only the `normal`/`disabled` pair a static render
 *    ever needs.
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

/** `scene/theme/icons/checked.svg` (16x16). */
const CHECKED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjE0IiBoZWlnaHQ9IjE0IiB4PSIxIiB5PSIxIiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9Ii43NSIgcng9IjIuMzMzIi8+PHBhdGggZmlsbD0iIzFhMWExYSIgZD0ibTExLjUgMy43NS01LjYgNS42LTEuNy0xLjctMS41IDEuNSAzLjIgMy4yIDcuMS03LjF6Ii8+PC9zdmc+Cg==';

/** `scene/theme/icons/checked_disabled.svg` (16x16). */
const CHECKED_DISABLED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjE0IiBoZWlnaHQ9IjE0IiB4PSIxIiB5PSIxIiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9Ii4zNyIgcng9IjIuMzMzIi8+PHBhdGggZmlsbD0iIzFhMWExYSIgZmlsbC1vcGFjaXR5PSIuNSIgZD0ibTExLjUgMy43NS01LjYgNS42LTEuNy0xLjctMS41IDEuNSAzLjIgMy4yIDcuMS03LjF6Ii8+PC9zdmc+Cg==';

/** `scene/theme/icons/unchecked.svg` (16x16). */
const UNCHECKED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjE0IiBoZWlnaHQ9IjE0IiB4PSIxIiB5PSIxIiBmaWxsPSIjMWExYTFhIiBmaWxsLW9wYWNpdHk9Ii41IiByeD0iMi4zMzMiLz48L3N2Zz4K';

/** `scene/theme/icons/unchecked_disabled.svg` (16x16). */
const UNCHECKED_DISABLED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjE0IiBoZWlnaHQ9IjE0IiB4PSIxIiB5PSIxIiBmaWxsPSIjMWExYTFhIiBmaWxsLW9wYWNpdHk9Ii4yNSIgcng9IjIuMzMzIi8+PC9zdmc+Cg==';

/** `scene/theme/icons/radio_checked.svg` (16x16). */
const RADIO_CHECKED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjUuNSIgZmlsbD0iIzFhMWExYSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utb3BhY2l0eT0iLjc1IiBzdHJva2Utd2lkdGg9IjMiLz48L3N2Zz4K';

/** `scene/theme/icons/radio_checked_disabled.svg` (16x16). */
const RADIO_CHECKED_DISABLED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjciIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjM3Ii8+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjQiIGZpbGw9IiMxYTFhMWEiIGZpbGwtb3BhY2l0eT0iLjUiLz48L3N2Zz4K';

/** `scene/theme/icons/radio_unchecked.svg` (16x16). */
const RADIO_UNCHECKED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjciIGZpbGw9IiMxYTFhMWEiIGZpbGwtb3BhY2l0eT0iLjUiLz48L3N2Zz4K';

/** `scene/theme/icons/radio_unchecked_disabled.svg` (16x16). */
const RADIO_UNCHECKED_DISABLED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjciIGZpbGw9IiMxYTFhMWEiIGZpbGwtb3BhY2l0eT0iLjI1Ii8+PC9zdmc+Cg==';

/** `scene/theme/icons/option_button_arrow.svg` (12x12). */
const OPTION_BUTTON_ARROW_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiI+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYjJiMmIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIuODUiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTIgNCA0IDQgNC00Ii8+PC9zdmc+Cg==';

/** CheckBox's eight icon draw states — `default_theme.cpp:288-295`. */
export interface CheckBoxIcons {
  checked: string;
  checkedDisabled: string;
  unchecked: string;
  uncheckedDisabled: string;
  radioChecked: string;
  radioCheckedDisabled: string;
  radioUnchecked: string;
  radioUncheckedDisabled: string;
}

export const CHECK_BOX_ICONS: CheckBoxIcons = {
  checked: svgDataUrl(CHECKED_B64),
  checkedDisabled: svgDataUrl(CHECKED_DISABLED_B64),
  unchecked: svgDataUrl(UNCHECKED_B64),
  uncheckedDisabled: svgDataUrl(UNCHECKED_DISABLED_B64),
  radioChecked: svgDataUrl(RADIO_CHECKED_B64),
  radioCheckedDisabled: svgDataUrl(RADIO_CHECKED_DISABLED_B64),
  radioUnchecked: svgDataUrl(RADIO_UNCHECKED_B64),
  radioUncheckedDisabled: svgDataUrl(RADIO_UNCHECKED_DISABLED_B64),
};

/** OptionButton's single icon — `default_theme.cpp:235`. */
export interface OptionButtonIcons {
  arrow: string;
}

export const OPTION_BUTTON_ICONS: OptionButtonIcons = {
  arrow: svgDataUrl(OPTION_BUTTON_ARROW_B64),
};

/** `scene/theme/icons/hsplitter.svg` (8×48) — HSplitContainer's grabber. */
const HSPLITTER_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjQ4Ij48cGF0aCBmaWxsPSJncmF5IiBmaWxsLW9wYWNpdHk9Ii42NSIgZD0iTTMuMTUgNHY0MGgxLjdWNHoiLz48L3N2Zz4K';

/** `scene/theme/icons/vsplitter.svg` (48×8) — VSplitContainer's grabber. */
const VSPLITTER_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI4Ij48cGF0aCBmaWxsPSJub25lIiBzdHJva2U9ImdyYXkiIHN0cm9rZS1vcGFjaXR5PSIuNjUiIHN0cm9rZS13aWR0aD0iMS43IiBkPSJNNCA0aDQwIi8+PC9zdmc+Cg==';

/** SplitContainer family's single grabber icon, per axis — `default_theme.cpp:1244-1247`. */
export interface SplitContainerIcons {
  hsplitter: string;
  vsplitter: string;
}

export const SPLIT_CONTAINER_ICONS: SplitContainerIcons = {
  hsplitter: svgDataUrl(HSPLITTER_B64),
  vsplitter: svgDataUrl(VSPLITTER_B64),
};

/** `scene/theme/icons/slider_grabber.svg` (16x16) — HSlider/VSlider's `grabber` icon. */
const SLIDER_GRABBER_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjciIGZpbGw9IiNmZWZlZmUiIGZpbGwtb3BhY2l0eT0iLjc1Ii8+PC9zdmc+Cg==';

/** `scene/theme/icons/slider_grabber_disabled.svg` (16x16) — HSlider/VSlider's `grabber_disabled` icon. */
const SLIDER_GRABBER_DISABLED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjciIGZpbGw9IiNmZWZlZmUiIGZpbGwtb3BhY2l0eT0iLjM3Ii8+PC9zdmc+Cg==';

/** `scene/theme/icons/hslider_tick.svg` (4x8) — HSlider's `tick` icon. */
const HSLIDER_TICK_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjgiPjxwYXRoIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjI1IiBkPSJNMSAwaDJ2MTZIMXoiLz48L3N2Zz4K';

/** `scene/theme/icons/vslider_tick.svg` (8x4) — VSlider's `tick` icon. */
const VSLIDER_TICK_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjQiPjxwYXRoIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjI1IiBkPSJNMCAzVjFoMTZ2MnoiLz48L3N2Zz4K';

/** HSlider/VSlider's `grabber`/`grabber_disabled` icons — identical for both orientations (`default_theme.cpp:589-591,604-606`). */
export interface SliderGrabberIcons {
  grabber: string;
  grabberDisabled: string;
}

export const SLIDER_GRABBER_ICONS: SliderGrabberIcons = {
  grabber: svgDataUrl(SLIDER_GRABBER_B64),
  grabberDisabled: svgDataUrl(SLIDER_GRABBER_DISABLED_B64),
};

/** HSlider/VSlider's single `tick` icon, per axis (`default_theme.cpp:592,607`). */
export interface SliderTickIcons {
  hslider: string;
  vslider: string;
}

export const SLIDER_TICK_ICONS: SliderTickIcons = {
  hslider: svgDataUrl(HSLIDER_TICK_B64),
  vslider: svgDataUrl(VSLIDER_TICK_B64),
};
