/**
 * The default theme's `TabContainer` and `TabBar` boxes for each tab state. `nativeTheme.ts`
 * holds them as `widgets.tabContainer`, and `mode_button_normal` and `mode_button_pressed` of the
 * ColorPicker bind two of them (`color_picker.cpp:2060-2061`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rgba } from '../../../godot/math/math';
import { flatStyleBox, freezeStyleBox, type FrozenStyleBoxData } from './styleBoxFlat';

/** `Color(1, 1, 1, 0.75)`: `style_focus_color` (`default_theme.cpp:117`), `style_tab_selected`'s top border (`:975-976`). */
const TAB_SELECTED_BORDER_COLOR: Rgba = { r: 1, g: 1, b: 1, a: 0.75 };
/** `Color(0.175, 0.175, 0.175, 1)`: `style_popup_border_color` (`default_theme.cpp:119`), `style_tab_unselected`'s left and right border (`:981`), inherited by `tab_disabled`/`tab_hovered`. */
const TAB_UNSELECTED_BORDER_COLOR: Rgba = { r: 0.175, g: 0.175, b: 0.175, a: 1 };
/** `style_pressed_color` (`default_theme.cpp:115`): `style_tab_unselected`'s fill (`:977`). */
const TAB_UNSELECTED_FILL: Rgba = { r: 0, g: 0, b: 0, a: 0.6 };
/** `style_disabled_color` (`default_theme.cpp:116`): `style_tab_disabled`'s fill, set on the `duplicate()` (`:983`). */
const TAB_DISABLED_FILL: Rgba = { r: 0.1, g: 0.1, b: 0.1, a: 0.3 };
/** `style_normal_color` (`default_theme.cpp:112`): `style_tab_selected`'s fill (`:974`). */
const TAB_SELECTED_FILL: Rgba = { r: 0.1, g: 0.1, b: 0.1, a: 0.6 };
/** A `Color(0.1, 0.1, 0.1, 0.3)` literal: `style_tab_hovered`'s fill (`default_theme.cpp:985`), apart from `TAB_DISABLED_FILL` although the numbers match. */
const TAB_HOVERED_FILL: Rgba = { r: 0.1, g: 0.1, b: 0.1, a: 0.3 };

export interface TabBarStyleBoxes {
  readonly selected: FrozenStyleBoxData;
  readonly unselected: FrozenStyleBoxData;
  readonly disabled: FrozenStyleBoxData;
  readonly hovered: FrozenStyleBoxData;
}

/**
 * `default_theme.cpp:974-985`: `tab_selected` and `tab_unselected` are
 * `make_flat_stylebox(color, 10, 4, 10, 4, 0)`, each with a border width scaled
 * apart from the margins: `round(2 * scale)` on selected's top, `round(scale)` on
 * unselected's sides. `tab_disabled`/`tab_hovered` duplicate unselected and change only `bg_color` (`:982-985`).
 */
export function tabBarStyleBoxes(scale: number): TabBarStyleBoxes {
  const contentMargin = {
    left: Math.round(10 * scale),
    top: Math.round(4 * scale),
    right: Math.round(10 * scale),
    bottom: Math.round(4 * scale),
  };
  const unselectedBorder = Math.round(1 * scale);
  const selected = flatStyleBox(TAB_SELECTED_FILL, {
    contentMargin,
    borderWidth: { left: 0, top: Math.round(2 * scale), right: 0, bottom: 0 },
    borderColor: TAB_SELECTED_BORDER_COLOR,
  });
  const unselected = flatStyleBox(TAB_UNSELECTED_FILL, {
    contentMargin,
    borderWidth: { left: unselectedBorder, top: 0, right: unselectedBorder, bottom: 0 },
    borderColor: TAB_UNSELECTED_BORDER_COLOR,
  });
  const disabled = { ...unselected, bgColor: TAB_DISABLED_FILL };
  const hovered = { ...unselected, bgColor: TAB_HOVERED_FILL };

  return {
    selected: freezeStyleBox(selected),
    unselected: freezeStyleBox(unselected),
    disabled: freezeStyleBox(disabled),
    hovered: freezeStyleBox(hovered),
  };
}
