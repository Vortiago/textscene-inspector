/**
 * Godot default-theme SVG icons the native (WebGL) Control painters need,
 * vendored as inline `data:` URLs.
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
 *  - CheckButton (`default_theme.cpp:327-330`), the toggle-switch pair:
 *      set_icon("checked",            "CheckButton", icons["toggle_on"])
 *      set_icon("checked_disabled",   "CheckButton", icons["toggle_on_disabled"])
 *      set_icon("unchecked",          "CheckButton", icons["toggle_off"])
 *      set_icon("unchecked_disabled", "CheckButton", icons["toggle_off_disabled"])
 *    plus the four `_mirrored` twins (`:332-335`), which
 *    `CheckButton::_notification` selects whole under `is_layout_rtl()`
 *    (`check_button.cpp:109-120`).
 *  - FoldableContainer (`default_theme.cpp:1329-1332`), the fold-state arrows:
 *      set_icon("expanded_arrow",          "FoldableContainer", icons["arrow_down"])
 *      set_icon("expanded_arrow_mirrored", "FoldableContainer", icons["arrow_up"])
 *      set_icon("folded_arrow",            "FoldableContainer", icons["arrow_right"])
 *      set_icon("folded_arrow_mirrored",   "FoldableContainer", icons["arrow_left"])
 *    `FoldableContainer::_get_title_icon` (`foldable_container.cpp:428-435`)
 *    never picks the RTL-only `folded_arrow_mirrored` in this codebase, but
 *    `expanded_arrow_mirrored` IS reachable through `title_position` alone,
 *    so the pair is vended together.
 *  - CodeEdit (`default_theme.cpp:496,498`), the fold-gutter arrows
 *    `can_fold_line` decides between:
 *      set_icon("can_fold",             "CodeEdit", icons["arrow_down"])
 *      set_icon("can_fold_code_region", "CodeEdit", icons["region_unfolded"])
 *    Their `folded`/`folded_code_region` twins (`:497,499`) are not vended:
 *    nothing in a `.tscn` folds a line, so neither can be reached.
 *  - TextEdit / CodeEdit (`default_theme.cpp:457-458,491-492`), the
 *    `draw_tabs`/`draw_spaces` visual-whitespace glyphs — both classes bind
 *    the identical two keys to the identical two icons:
 *      set_icon("tab",   "TextEdit", icons["text_edit_tab"])
 *      set_icon("space", "TextEdit", icons["text_edit_space"])
 *      set_icon("tab",   "CodeEdit", icons["text_edit_tab"])
 *      set_icon("space", "CodeEdit", icons["text_edit_space"])
 *  - ScrollContainer (`default_theme.cpp:667-668`), the edge fades
 *    `_update_scroll_hints` shows when the content continues past an edge:
 *      set_icon("scroll_hint_vertical",   "ScrollContainer", icons["scroll_hint_vertical"])
 *      set_icon("scroll_hint_horizontal", "ScrollContainer", icons["scroll_hint_horizontal"])
 *  - TabBar (`default_theme.cpp:1034,1036,1039`), the tab-strip icons —
 *    `TabContainer` reuses TabBar's own painter rather than a second copy:
 *      set_icon("increment", "TabBar", icons["scroll_button_right"])
 *      set_icon("decrement", "TabBar", icons["scroll_button_left"])
 *      set_icon("close",     "TabBar", icons["close"])
 *    The `_highlight` (hover) variants (`:1035,1037`) are not vended, same
 *    restriction as Slider's `grabber_highlight` above.
 *  - ColorPicker / ColorPickerButton (`default_theme.cpp:1088-1101,1133`),
 *    the swatch/cursor/button icons — `ColorPickerButton`'s own
 *    `overbright_indicator` is `BIND_THEME_ITEM_EXT`'d straight to
 *    ColorPicker's key (`color_picker.cpp:2546`), so it is the SAME icon
 *    under one key, not a second copy:
 *      set_icon("menu_option",         "ColorPicker",       icons["tabs_menu_hl"])
 *      set_icon("screen_picker",       "ColorPicker",       icons["color_picker_pipette"])
 *      set_icon("shape_rect",          "ColorPicker",       icons["picker_shape_rectangle"])
 *      set_icon("sample_bg",           "ColorPicker",       icons["mini_checkerboard"])
 *      set_icon("bg",                  "ColorPickerButton",  icons["mini_checkerboard"])
 *      set_icon("overbright_indicator","ColorPicker",       icons["color_picker_overbright"])
 *      set_icon("bar_arrow",           "ColorPicker",       icons["color_picker_bar_arrow"])
 *      set_icon("picker_cursor",       "ColorPicker",       icons["color_picker_cursor"])
 *      set_icon("picker_cursor_bg",    "ColorPicker",       icons["color_picker_cursor_bg"])
 *    `menu_option` reaches TWO buttons (`btn_mode`/`menu_btn`,
 *    `color_picker.cpp:119-120`), so it is vended once and shared, matching
 *    `overbright_indicator`'s own precedent above. `bar_arrow` overrides
 *    `sliders[0..2]`/`alpha_slider`'s own `grabber`/`grabber_highlight`
 *    (`color_picker.cpp:636-637,646-647`) — `intensity_slider` alone keeps
 *    HSlider's own default `grabber` (`SLIDER_GRABBER_ICONS`, already
 *    vendored above), so it is not revended here. `shape_rect` is vended
 *    for `btn_shape` at the one `picker_shape` this previewer draws
 *    (`SHAPE_HSV_RECTANGLE`) — `shape_circle`/`shape_rect_wheel` are not,
 *    matching the shader-backed shapes' own "out of scope" (`comparison.md`).
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

/** `scene/theme/icons/toggle_on.svg` (32x16) — CheckButton's `checked`. */
const TOGGLE_ON_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjMwIiBoZWlnaHQ9IjE0IiB4PSIxIiB5PSIxIiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9Ii43NSIgcng9IjciLz48Y2lyY2xlIGN4PSIyNCIgY3k9IjgiIHI9IjUiIGZpbGw9IiMxYTFhMWEiLz48L3N2Zz4K';

/** `scene/theme/icons/toggle_off.svg` (32x16) — CheckButton's `unchecked`. */
const TOGGLE_OFF_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIxNiI+PGcgZmlsbC1vcGFjaXR5PSIuNSI+PHJlY3Qgd2lkdGg9IjMwIiBoZWlnaHQ9IjE0IiB4PSIxIiB5PSIxIiBmaWxsPSIjMWExYTFhIiByeD0iNyIvPjxjaXJjbGUgY3g9IjgiIGN5PSI4IiByPSI1IiBmaWxsPSIjZmZmIi8+PC9nPjwvc3ZnPgo=';

/** `scene/theme/icons/toggle_on_disabled.svg` (32x16) — CheckButton's `checked_disabled`. */
const TOGGLE_ON_DISABLED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjMwIiBoZWlnaHQ9IjE0IiB4PSIxIiB5PSIxIiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9Ii4zNyIgcng9IjciLz48Y2lyY2xlIGN4PSIyNCIgY3k9IjgiIHI9IjUiIGZpbGw9IiMxYTFhMWEiIGZpbGwtb3BhY2l0eT0iLjUiLz48L3N2Zz4K';

/** `scene/theme/icons/toggle_off_disabled.svg` (32x16) — CheckButton's `unchecked_disabled`. */
const TOGGLE_OFF_DISABLED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIxNiI+PGcgZmlsbC1vcGFjaXR5PSIuMjUiPjxyZWN0IHdpZHRoPSIzMCIgaGVpZ2h0PSIxNCIgeD0iMSIgeT0iMSIgZmlsbD0iIzFhMWExYSIgcng9IjciLz48Y2lyY2xlIGN4PSI4IiBjeT0iOCIgcj0iNSIgZmlsbD0iI2ZmZiIvPjwvZz48L3N2Zz4K';

/** `scene/theme/icons/toggle_on_mirrored.svg` (32x16) — CheckButton's `checked_mirrored`. */
const TOGGLE_ON_MIRRORED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjMwIiBoZWlnaHQ9IjE0IiB4PSIxIiB5PSIxIiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9Ii43NSIgcng9IjciLz48Y2lyY2xlIGN4PSI4IiBjeT0iOCIgcj0iNSIgZmlsbD0iIzFhMWExYSIvPjwvc3ZnPgo=';

/** `scene/theme/icons/toggle_off_mirrored.svg` (32x16) — CheckButton's `unchecked_mirrored`. */
const TOGGLE_OFF_MIRRORED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIxNiI+PGcgZmlsbC1vcGFjaXR5PSIuNSI+PHJlY3Qgd2lkdGg9IjMwIiBoZWlnaHQ9IjE0IiB4PSIxIiB5PSIxIiBmaWxsPSIjMWExYTFhIiByeD0iNyIvPjxjaXJjbGUgY3g9IjI0IiBjeT0iOCIgcj0iNSIgZmlsbD0iI2ZmZiIvPjwvZz48L3N2Zz4K';

/** `scene/theme/icons/toggle_on_disabled_mirrored.svg` (32x16) — CheckButton's `checked_disabled_mirrored`. */
const TOGGLE_ON_DISABLED_MIRRORED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjMwIiBoZWlnaHQ9IjE0IiB4PSIxIiB5PSIxIiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9Ii4zNyIgcng9IjciLz48Y2lyY2xlIGN4PSI4IiBjeT0iOCIgcj0iNSIgZmlsbD0iIzFhMWExYSIgZmlsbC1vcGFjaXR5PSIuNSIvPjwvc3ZnPgo=';

/** `scene/theme/icons/toggle_off_disabled_mirrored.svg` (32x16) — CheckButton's `unchecked_disabled_mirrored`. */
const TOGGLE_OFF_DISABLED_MIRRORED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIxNiI+PGcgZmlsbC1vcGFjaXR5PSIuMjUiPjxyZWN0IHdpZHRoPSIzMCIgaGVpZ2h0PSIxNCIgeD0iMSIgeT0iMSIgZmlsbD0iIzFhMWExYSIgcng9IjciLz48Y2lyY2xlIGN4PSIyNCIgY3k9IjgiIHI9IjUiIGZpbGw9IiNmZmYiLz48L2c+PC9zdmc+Cg==';

/** CheckButton's eight icon draw states — the four plain (`default_theme.cpp:327-330`) and their RTL twins (`:332-335`), which are separate authored SVGs rather than a flip of the plain ones. */
export interface CheckButtonIcons {
  checked: string;
  checkedDisabled: string;
  unchecked: string;
  uncheckedDisabled: string;
  checkedMirrored: string;
  checkedDisabledMirrored: string;
  uncheckedMirrored: string;
  uncheckedDisabledMirrored: string;
}

export const CHECK_BUTTON_ICONS: CheckButtonIcons = {
  checked: svgDataUrl(TOGGLE_ON_B64),
  checkedDisabled: svgDataUrl(TOGGLE_ON_DISABLED_B64),
  unchecked: svgDataUrl(TOGGLE_OFF_B64),
  uncheckedDisabled: svgDataUrl(TOGGLE_OFF_DISABLED_B64),
  checkedMirrored: svgDataUrl(TOGGLE_ON_MIRRORED_B64),
  checkedDisabledMirrored: svgDataUrl(TOGGLE_ON_DISABLED_MIRRORED_B64),
  uncheckedMirrored: svgDataUrl(TOGGLE_OFF_MIRRORED_B64),
  uncheckedDisabledMirrored: svgDataUrl(TOGGLE_OFF_DISABLED_MIRRORED_B64),
};

/** Every vendored CheckButton icon shares this authored size (`toggle_on.svg` et al, 32x16). */
export const CHECK_BUTTON_ICON_NATURAL_SIZE = { x: 32, y: 16 };

/** `scene/theme/icons/arrow_down.svg` (16x16) — FoldableContainer's `expanded_arrow`. */
const ARROW_DOWN_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYjJiMmIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIuNDUiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTUgNyAzIDMgMy0zIi8+PC9zdmc+Cg==';

/** `scene/theme/icons/arrow_up.svg` (16x16) — FoldableContainer's `expanded_arrow_mirrored` (used at `title_position = Bottom`, not for RTL). */
const ARROW_UP_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYjJiMmIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIuNDUiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTExLjAxMTA2MyA5Ljk3NzYyNDYtMy4wMjIyMDk0LTIuOTc3NjI0Ni0yLjk3NzYyNDcgMy4wMjIyMSIvPjwvc3ZnPgo=';

/** `scene/theme/icons/arrow_right.svg` (16x16) — FoldableContainer's `folded_arrow`. */
const ARROW_RIGHT_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYjJiMmIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIuNDUiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTYgMTEgMy0zLTMtMyIvPjwvc3ZnPgo=';

/** `scene/theme/icons/arrow_left.svg` (16x16) — FoldableContainer's `folded_arrow_mirrored` (RTL only, never selected here). */
const ARROW_LEFT_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYjJiMmIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIuNDUiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTkgMTEtMy0zIDMtMyIvPjwvc3ZnPgo=';

/** FoldableContainer's four fold-state arrow icons — `default_theme.cpp:1329-1332`. */
export interface FoldableContainerIcons {
  expandedArrow: string;
  expandedArrowMirrored: string;
  foldedArrow: string;
  foldedArrowMirrored: string;
}

export const FOLDABLE_CONTAINER_ICONS: FoldableContainerIcons = {
  expandedArrow: svgDataUrl(ARROW_DOWN_B64),
  expandedArrowMirrored: svgDataUrl(ARROW_UP_B64),
  foldedArrow: svgDataUrl(ARROW_RIGHT_B64),
  foldedArrowMirrored: svgDataUrl(ARROW_LEFT_B64),
};

/** `scene/theme/icons/region_unfolded.svg` (12x12) — CodeEdit's `can_fold_code_region`. */
const REGION_UNFOLDED_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTEwIDNhMSAxIDAgMCAwLTEtMUgzYTEgMSAwIDAgMC0xIDF2NmExIDEgMCAwIDAgMSAxaDZhMSAxIDAgMCAwIDEtMXpNMyA1Ljc1YTEgMSAwIDAgMSAxLjQxNC0xLjQxNEw2IDUuOTIybDEuNTg2LTEuNTg2QTEgMSAwIDAgMSA5IDUuNzVMNi43MDcgOC4wNDNhMSAxIDAgMCAxLTEuNDE0IDB6Ii8+PC9zdmc+Cg==';

/**
 * CodeEdit's fold-gutter icons — `default_theme.cpp:496-499`. Only the two a
 * STILL frame can reach are vended: nothing in a `.tscn` folds a line, so
 * `folded`/`folded_code_region` never draw (`can_fold_line`'s own doc in
 * `nodes/2d/ui/codeedit/lineFolding.ts`). `can_fold` is `arrow_down.svg`
 * again, the same asset FoldableContainer's `expanded_arrow` is.
 */
export interface CodeEditFoldIcons {
  canFold: string;
  canFoldCodeRegion: string;
}

export const CODE_EDIT_FOLD_ICONS: CodeEditFoldIcons = {
  canFold: svgDataUrl(ARROW_DOWN_B64),
  canFoldCodeRegion: svgDataUrl(REGION_UNFOLDED_B64),
};

/** `scene/theme/icons/text_edit_tab.svg` (8x8) — TextEdit/CodeEdit's `tab`. */
const TEXT_EDIT_TAB_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxwYXRoIGZpbGw9IiNiMmIyYjIiIGZpbGwtb3BhY2l0eT0iLjI1IiBkPSJNNiAwdjhoMlYwek0xIDBhMSAxIDAgMCAwLS42OTMgMS43MDVMMi42IDMuOTk4LjMwNyA2LjI5MUExIDEgMCAwIDAgMS43MiA3LjcwNWwzLTNhMSAxIDAgMCAwIDAtMS40MTRsLTMtM0ExIDEgMCAwIDAgMSAweiIvPjwvc3ZnPgo=';

/** `scene/theme/icons/text_edit_space.svg` (8x8) — TextEdit/CodeEdit's `space`. */
const TEXT_EDIT_SPACE_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxjaXJjbGUgY3g9IjQiIGN5PSI0IiByPSIxLjUiIGZpbGw9IiNiMmIyYjIiIGZpbGwtb3BhY2l0eT0iLjI1Ii8+PC9zdmc+Cg==';

/** TextEdit's/CodeEdit's shared `tab`/`space` glyphs — `default_theme.cpp:457-458,491-492`. */
export interface TextEditGlyphIcons {
  tab: string;
  space: string;
}

export const TEXT_EDIT_GLYPH_ICONS: TextEditGlyphIcons = {
  tab: svgDataUrl(TEXT_EDIT_TAB_B64),
  space: svgDataUrl(TEXT_EDIT_SPACE_B64),
};

/** `scene/theme/icons/scroll_hint_vertical.svg` (32x24) — ScrollContainer's `scroll_hint_vertical`: a white gradient from alpha 0.3 at the top edge to 0 at the bottom, uniform across its width. */
const SCROLL_HINT_VERTICAL_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMzIiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCA4LjQ2NyA2LjM1Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImEiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2ZmZiIgc3RvcC1vcGFjaXR5PSIuMyIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2ZmZiIgc3RvcC1vcGFjaXR5PSIwIi8+PC9saW5lYXJHcmFkaWVudD48bGluZWFyR3JhZGllbnQgeGxpbms6aHJlZj0iI2EiIGlkPSJiIiB4MT0iNC4yMzMiIHgyPSI0LjIzMyIgeTE9IjAiIHkyPSI2LjM1IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIvPjwvZGVmcz48cGF0aCBmaWxsPSJ1cmwoI2IpIiBkPSJNMCAwSDguNDY3VjYuMzVIMHoiIHBhaW50LW9yZGVyPSJmaWxsIG1hcmtlcnMgc3Ryb2tlIi8+PC9zdmc+Cg==';

/** `scene/theme/icons/scroll_hint_horizontal.svg` (24x32) — ScrollContainer's `scroll_hint_horizontal`: the same gradient rotated, so it is uniform down its height. */
const SCROLL_HINT_HORIZONTAL_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMjQiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCA2LjM1IDguNDY3Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImEiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2ZmZiIgc3RvcC1vcGFjaXR5PSIuMyIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2ZmZiIgc3RvcC1vcGFjaXR5PSIwIi8+PC9saW5lYXJHcmFkaWVudD48bGluZWFyR3JhZGllbnQgeGxpbms6aHJlZj0iI2EiIGlkPSJiIiB4MT0iNC4yMzMiIHgyPSI0LjIzMyIgeTE9IjAiIHkyPSI2LjM1IiBncmFkaWVudFRyYW5zZm9ybT0idHJhbnNsYXRlKC04LjQ2NykiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIi8+PC9kZWZzPjxwYXRoIGZpbGw9InVybCgjYikiIGQ9Ik0tOC40NjcgMEgwVjYuMzVILTguNDY3eiIgcGFpbnQtb3JkZXI9ImZpbGwgbWFya2VycyBzdHJva2UiIHRyYW5zZm9ybT0icm90YXRlKC05MCkiLz48L3N2Zz4K';

/** ScrollContainer's two edge-fade hints — `default_theme.cpp:667-668`. */
export interface ScrollHintIcons {
  vertical: string;
  horizontal: string;
}

export const SCROLL_HINT_ICONS: ScrollHintIcons = {
  vertical: svgDataUrl(SCROLL_HINT_VERTICAL_B64),
  horizontal: svgDataUrl(SCROLL_HINT_HORIZONTAL_B64),
};

/** `scene/theme/icons/close.svg` (16x16) — TabBar's `close`. */
const TAB_BAR_CLOSE_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIuNzUiIGQ9Im0xIDMgMi0yIDUgNSA1LTUgMiAyLTUgNSA1IDUtMiAyLTUtNS01IDUtMi0yIDUtNXoiLz48L3N2Zz4K';

/** `scene/theme/icons/scroll_button_right.svg` (16x16) — TabBar's `increment`. */
const TAB_BAR_SCROLL_RIGHT_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjYiIGZpbGw9IiNmZWZmZmUiIGZpbGwtb3BhY2l0eT0iLjc1Ii8+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMWExYTFhIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIuNjUiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTcgNSAzIDMtMyAzIi8+PC9zdmc+Cg==';

/** `scene/theme/icons/scroll_button_left.svg` (16x16) — TabBar's `decrement`. */
const TAB_BAR_SCROLL_LEFT_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjYiIGZpbGw9IiNmZWZmZmUiIGZpbGwtb3BhY2l0eT0iLjc1Ii8+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMWExYTFhIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIuNjUiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTkgNS0zIDMgMyAzIi8+PC9zdmc+Cg==';

/** TabBar's close and scroll-arrow icons — `default_theme.cpp:1034,1036,1039`. */
export interface TabBarIcons {
  close: string;
  incrementScroll: string;
  decrementScroll: string;
}

export const TAB_BAR_ICONS: TabBarIcons = {
  close: svgDataUrl(TAB_BAR_CLOSE_B64),
  incrementScroll: svgDataUrl(TAB_BAR_SCROLL_RIGHT_B64),
  decrementScroll: svgDataUrl(TAB_BAR_SCROLL_LEFT_B64),
};

/** Every vendored TabBar icon shares this authored size (16x16) — never rescaled by the project theme scale, same limitation as `SPIN_BOX_ARROW_ICON_SIZE`. */
export const TAB_BAR_ICON_SIZE = 16;

/** `scene/theme/icons/mini_checkerboard.svg` (16x16) — the alpha-preview tile, `ColorPicker`'s `sample_bg` and `ColorPickerButton`'s `bg`. */
const MINI_CHECKERBOARD_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0iZ3JheSIgZD0iTTAgMHY4aDhWMHptOCA4djhoOFY4eiIvPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik04IDB2OGg4VjB6bTAgOEgwdjhoOHoiLz48L3N2Zz4K';

/** `scene/theme/icons/color_picker_overbright.svg` (16x16) — `ColorPicker`'s `overbright_indicator`, reused by `ColorPickerButton` under the same key (`color_picker.cpp:2546`). */
const COLOR_PICKER_OVERBRIGHT_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjMDAwMDAzIiBkPSJtLjUuNXYxMGwxMC0xMHoiLz48L3N2Zz4K';

/** `scene/theme/icons/color_picker_cursor.svg` (12x12) — the SV-square cursor ring, `ColorPicker`'s `picker_cursor`. */
const COLOR_PICKER_CURSOR_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiI+PGNpcmNsZSBjeD0iNiIgY3k9IjYiIHI9IjUiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZiIvPjxjaXJjbGUgY3g9IjYiIGN5PSI2IiByPSI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAiLz48L3N2Zz4K';

/** `scene/theme/icons/color_picker_cursor_bg.svg` (12x12) — the cursor's own-colour fill, `ColorPicker`'s `picker_cursor_bg`. */
const COLOR_PICKER_CURSOR_BG_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiI+PGNpcmNsZSBjeD0iNiIgY3k9IjYiIHI9IjQiIGZpbGw9IiNmZmYiLz48L3N2Zz4K';

/** ColorPicker's/ColorPickerButton's checkerboard, overbright and cursor icons — `default_theme.cpp:1096,1098,1100-1101,1133`. */
export const MINI_CHECKERBOARD_ICON = svgDataUrl(MINI_CHECKERBOARD_B64);
export const COLOR_PICKER_OVERBRIGHT_ICON = svgDataUrl(COLOR_PICKER_OVERBRIGHT_B64);
export const COLOR_PICKER_CURSOR_ICON = svgDataUrl(COLOR_PICKER_CURSOR_B64);
export const COLOR_PICKER_CURSOR_BG_ICON = svgDataUrl(COLOR_PICKER_CURSOR_BG_B64);

/** The checkerboard tile's own natural size — 16x16. */
export const MINI_CHECKERBOARD_SIZE = 16;

/** `scene/theme/icons/tabs_menu_hl.svg` (16x16) — `ColorPicker`'s `menu_option`, shared by `btn_mode` and `menu_btn` (`default_theme.cpp:1088`, `color_picker.cpp:119-120`). */
const COLOR_PICKER_MENU_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0iI2IyYjJiMiIgZmlsbC1vcGFjaXR5PSIuNjUiIGQ9Ik04IDBhMiAyIDAgMCAwIDAgNCAyIDIgMCAwIDAgMC00em0wIDZhMiAyIDAgMCAwIDAgNCAyIDIgMCAwIDAgMC00em0wIDZhMiAyIDAgMCAwIDAgNCAyIDIgMCAwIDAgMC00eiIvPjwvc3ZnPgo=';

/** `scene/theme/icons/color_picker_pipette.svg` (16x16) — `ColorPicker`'s `screen_picker`, `btn_pick`'s own icon (`default_theme.cpp:1091`, `color_picker.cpp:114`). */
const COLOR_PICKER_PIPETTE_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0iI2IyYjJiMiIgZD0iTTEwIDNhMSAxIDAgMCAwLTQgMHYySDV2MmgxdjVjMCAuNzEyLjM2IDEuMzcyIDEgMS43M1YxNWgydi0xLjI3Yy42MTgtLjM2IDEtMSAxLTEuNzNWN2gxVjVoLTFWM3pNNyA3aDJ2NWExIDEgMCAwIDEtMiAweiIvPjwvc3ZnPgo=';

/** `scene/theme/icons/picker_shape_rectangle.svg` (16x16) — `ColorPicker`'s `shape_rect`, `btn_shape`'s own icon at `picker_shape = SHAPE_HSV_RECTANGLE` (`default_theme.cpp:1093`). */
const COLOR_PICKER_SHAPE_RECT_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0iI2VhZWFlYSIgZD0iTS41IDIuNWgxMXYxMUguNXptMTIgMGgydjExaC0yeiIvPjwvc3ZnPgo=';

/** `scene/theme/icons/color_picker_bar_arrow.svg` (16x16, `viewBox="0 0 16 20"`) — `ColorPicker`'s `bar_arrow`, the channel/alpha slider grabber override (`default_theme.cpp:1099`). */
const COLOR_PICKER_BAR_ARROW_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDIwIj48cGF0aCBmaWxsPSIjYjJiMmIyIiBzdHJva2U9IiNiMmIyYjIiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGQ9Im0zLjU2NCAxNS4yMThoOC44NzJsLTQuNDM2LTQuNDM2eiIvPjwvc3ZnPgo=';

export const COLOR_PICKER_MENU_ICON = svgDataUrl(COLOR_PICKER_MENU_B64);
export const COLOR_PICKER_PIPETTE_ICON = svgDataUrl(COLOR_PICKER_PIPETTE_B64);
export const COLOR_PICKER_SHAPE_RECT_ICON = svgDataUrl(COLOR_PICKER_SHAPE_RECT_B64);
export const COLOR_PICKER_BAR_ARROW_ICON = svgDataUrl(COLOR_PICKER_BAR_ARROW_B64);

/** Every one of the four icons just above shares this authored size — 16x16, never rescaled by the project theme scale (same limitation as `SPIN_BOX_ARROW_ICON_SIZE`). */
export const COLOR_PICKER_BUTTON_ICON_SIZE = 16;

/** The cursor icons' own natural size — both 12x12. */
export const COLOR_PICKER_CURSOR_SIZE = 12;

/** `scene/theme/icons/zoom_less.svg` (16x16) — GraphEdit's `zoom_out`, `zoom_minus_button`'s icon (`default_theme.cpp:1279`). */
const GRAPH_EDIT_ZOOM_OUT_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjgiIGZpbGw9IiNiMmIyYjIiIGZpbGwtb3BhY2l0eT0iLjY1Ii8+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjciIGZpbGw9IiNmZWZmZmUiLz48cGF0aCBmaWxsPSIjMDEwMDAxIiBkPSJNNCA3aDh2Mkg0eiIvPjwvc3ZnPgo=';

/** `scene/theme/icons/zoom_more.svg` (16x16) — GraphEdit's `zoom_in` (`default_theme.cpp:1280`). */
const GRAPH_EDIT_ZOOM_IN_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjgiIGZpbGw9IiNiMmIyYjIiIGZpbGwtb3BhY2l0eT0iLjY1Ii8+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjciIGZpbGw9IiNmZWZmZmUiLz48cGF0aCBmaWxsPSIjMDEwMDAxIiBkPSJNNyA0aDJ2M2gzdjJIOXYzSDdWOUg0VjdoM3oiLz48L3N2Zz4K';

/** `scene/theme/icons/zoom_reset.svg` (16x16) — GraphEdit's `zoom_reset` (`default_theme.cpp:1281`). */
const GRAPH_EDIT_ZOOM_RESET_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjgiIGZpbGw9IiNiMmIyYjIiIGZpbGwtb3BhY2l0eT0iLjY1Ii8+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjciIGZpbGw9IiNmZWZmZmUiLz48cGF0aCBmaWxsPSIjMDEwMDAxIiBkPSJNOCA0LjE2NkExIDEgMCAwIDEgOS41MjYgNXY3aC0yVjYuODdsLTEuNDQ1Ljk2Mi0xLTEuNnoiLz48L3N2Zz4K';

/** `scene/theme/icons/grid_toggle.svg` (16x16) — GraphEdit's `grid_toggle` (`default_theme.cpp:1282`). */
const GRAPH_EDIT_GRID_TOGGLE_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0iI2IyYjJiMiIgZmlsbC1vcGFjaXR5PSIuNjUiIGQ9Ik0zIDB2M0gwdjJoM3Y0SDB2MmgzdjNoMlY1aDlWM2gtM1YwSDl2M0g1VjB6Ii8+PHBhdGggZmlsbD0iI2UwZTBlMCIgZD0iTTExIDYuNjJjLTEuNzQ3IDAtMy45NTcgMS4zNDQtNC43NTIgMy45MzZhLjY4My42OSAwIDAwLS4wMDQuMzk0QzcuMDEyIDEzLjY2NSA5LjI5MiAxNC45IDExIDE0LjljMS43MDggMCAzLjk4OC0xLjIzNSA0Ljc1Ni0zLjk1YS42ODMuNjkgMCAwMDAtLjM4MkMxNS4wMDQgNy45NTUgMTIuNzQ2IDYuNjIgMTEgNi42MnpNMTEgOGEyLjczMyAyLjc2IDAgMDEyLjczMyAyLjc2QTIuNzMzIDIuNzYgMCAwMTExIDEzLjUyYTIuNzMzIDIuNzYgMCAwMS0yLjczMy0yLjc2QTIuNzMzIDIuNzYgMCAwMTExIDh6bTAgMS4zOGExLjM2NyAxLjM4IDAgMDAtMS4zNjcgMS4zOEExLjM2NyAxLjM4IDAgMDAxMSAxMi4xNGExLjM2NyAxLjM4IDAgMDAxLjM2Ny0xLjM4QTEuMzY3IDEuMzggMCAwMDExIDkuMzh6Ii8+PC9zdmc+Cg==';

/** `scene/theme/icons/grid_minimap.svg` (16x16) — GraphEdit's `minimap_toggle` (`default_theme.cpp:1283`). */
const GRAPH_EDIT_MINIMAP_TOGGLE_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLW1pdGVybGltaXQ9IjIiPjxwYXRoIGZpbGw9IiNiMmIyYjIiIGZpbGwtb3BhY2l0eT0iLjY1IiBkPSJNMTQgMi4xOTl2Mi42MTVsLTIuNjI1IDEuMzEzVjMuNTEyek0yIDYuMjY0bDIuNjI1IDEuMzEydjIuNTUxTDIgOC44MTR6bTEyIDB2Mi41NWwtMi42MjUgMS4zMTNWNy41NzZ6TTYgNy43MTloNHYyLjY0SDZ6bS00IDIuNTYgMi42MjUgMS4zMTN2Mi41MjFMMiAxMi44MDF6bTEyIDB2Mi41MjJsLTIuNjI1IDEuMzEydi0yLjUyMXptLTggMS40NTVoNHYyLjY0MUg2em00LTguMTA5djIuNzM0SDUuODQ0cy0uNzQ5LjY0Ny0uODc1LjY0MWMtLjEzMS0uMDA3LTEuNTEtMS40NTYtMS41MS0xLjQ1NkwyIDQuODE0VjIuMTk5bC4xMTcuMDZzLS4wNjQtLjc3NS40MjQtMS4yMTZMMS4yNzkuNDQxQS42MjYuNjI2IDAgMCAwIC4zNzUgMXYxMmMwIC4yMzcuMTM0LjQ1My4zNDYuNTU5bDQgMmEuNjI2LjYyNiAwIDAgMCAuMjc5LjA2Nmg2YS42MjYuNjI2IDAgMCAwIC4yNzktLjA2Nmw0LTJhLjYyNS42MjUgMCAwIDAgLjM0Ni0uNTU5VjFhLjYyNS42MjUgMCAwIDAtLjkwNC0uNTU5bC0zLjg2OSAxLjkzNEg3Ljg4OHMuMDg0LjYyNC0uMjE4IDEuMjV6Ii8+PHBhdGggZmlsbD0iI2ZlZmZmZSIgZD0iTTUgNi4yNWMtNC0zLjUtMi02IDAtNnM0IDIuNSAwIDZ6Ii8+PC9zdmc+Cg==';

/** `scene/theme/icons/grid_snap.svg` (16x16) — GraphEdit's `snapping_toggle` (`default_theme.cpp:1284`). */
const GRAPH_EDIT_SNAPPING_TOGGLE_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0iI2IyYjJiMiIgZmlsbC1vcGFjaXR5PSIuNjUiIGQ9Ik0zIDB2M0gwdjJoM3Y0SDB2MmgzdjNoMlY1aDlWM2gtM1YwSDl2M0g1VjB6bTQgMTN2Mmgydi0yem02IDB2Mmgydi0yeiIvPjxwYXRoIGZpbGw9IiNmZWZmZmUiIGQ9Ik03IDExdjJoMnYtMmEyIDIgMCAwIDEgNCAwdjJoMnYtMmE0IDQgMCAwIDAtOCAweiIvPjwvc3ZnPgo=';

/** `scene/theme/icons/grid_layout.svg` (16x16) — GraphEdit's `layout`, `arrange_button`'s icon (`default_theme.cpp:1285`). */
const GRAPH_EDIT_LAYOUT_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PGcgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIxLjMiPjxwYXRoIHN0cm9rZT0iI2ZlZmZmZSIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTEuODcgNi41NDFoMi45MTd2Mi45MTdIMS44N3ptNC42NjYgMGgyLjkxN3YyLjkxN0g2LjUzNnptNC42NjYgMGgyLjkxN3YyLjkxN2gtMi45MTd6Ii8+PHBhdGggc3Ryb2tlPSIjZTBlMGUwIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIuNjUiIGQ9Im01LjQzMiAxLjExMi0xLjk1IDEuOTUgMS45NSAxLjk1bS0xLjk1LTEuOTVoOS4zODZtLTIuMTM3IDguMDUgMS45NSAxLjk1LTEuOTUgMS45NW0tNy40MzctMS45NWg5LjM4NyIvPjwvZz48L3N2Zz4K';

/** `scene/theme/icons/resizer_nw.svg` (16x16) — GraphEditMinimap's `resizer` (`default_theme.cpp:1349`). */
const GRAPH_EDIT_MINIMAP_RESIZER_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmVmZmZlIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIuNjUiIHN0cm9rZS13aWR0aD0iMiIgZD0iTTQgMTFWNGg3Ii8+PGNpcmNsZSBjeD0iNy41IiBjeT0iNy41IiByPSIxLjUiIGZpbGw9IiNiMmIyYjIiIGZpbGwtb3BhY2l0eT0iLjY1Ii8+PC9zdmc+Cg==';

/** GraphEdit's seven toolbar icons, keyed by its own theme keys — `default_theme.cpp:1279-1285`. */
export interface GraphEditIcons {
  zoomOut: string;
  zoomIn: string;
  zoomReset: string;
  gridToggle: string;
  minimapToggle: string;
  snappingToggle: string;
  layout: string;
}

export const GRAPH_EDIT_ICONS: GraphEditIcons = {
  zoomOut: svgDataUrl(GRAPH_EDIT_ZOOM_OUT_B64),
  zoomIn: svgDataUrl(GRAPH_EDIT_ZOOM_IN_B64),
  zoomReset: svgDataUrl(GRAPH_EDIT_ZOOM_RESET_B64),
  gridToggle: svgDataUrl(GRAPH_EDIT_GRID_TOGGLE_B64),
  minimapToggle: svgDataUrl(GRAPH_EDIT_MINIMAP_TOGGLE_B64),
  snappingToggle: svgDataUrl(GRAPH_EDIT_SNAPPING_TOGGLE_B64),
  layout: svgDataUrl(GRAPH_EDIT_LAYOUT_B64),
};

/** GraphEditMinimap's own single icon — `default_theme.cpp:1349`. */
export const GRAPH_EDIT_MINIMAP_RESIZER_ICON = svgDataUrl(GRAPH_EDIT_MINIMAP_RESIZER_B64);

/** Every GraphEdit/GraphEditMinimap icon above shares this authored size — 16x16, never rescaled by the project theme scale (same limitation as `SPIN_BOX_ARROW_ICON_SIZE`). */
export const GRAPH_EDIT_ICON_SIZE = 16;
