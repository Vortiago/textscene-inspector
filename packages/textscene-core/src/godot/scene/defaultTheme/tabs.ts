/**
 * The default theme's TabContainer and TabBar (`scene/theme/default_theme.cpp:972-1064`). The two share
 * their tab boxes and colours.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rgba } from '../../math/math.js';
import {
  CONTROL_FONT_DISABLED_COLOR,
  CONTROL_FONT_HOVER_COLOR,
  CONTROL_FONT_LOW_COLOR,
  scaledPx,
  STYLE_FILL,
} from '../theme.js';
import { buttonBoxes, focusStyleBox } from './button.js';
import { flatPanelStyleBox } from './containers.js';
import type {
  DefaultFlatStyleBox,
  DefaultStyleBox,
  DefaultThemeType,
  DefaultThemeTypes,
} from './defaultTheme.js';
import { allSides, makeEmptyStyleBox, makeFlatStyleBox, withBorder } from './styleBoxes.js';
import { BLACK, typeItems, WHITE } from './typeItems.js';

/** `style_popup_border_color` (`default_theme.cpp:119`): the edge between two unselected tabs. */
const POPUP_BORDER_COLOR: Rgba = { r: 0.175, g: 0.175, b: 0.175, a: 1 };

/** `style_tab_hovered`'s fill (`default_theme.cpp:985`). */
const TAB_HOVERED_FILL: Rgba = { r: 0.1, g: 0.1, b: 0.1, a: 0.3 };

/** The tab boxes (`default_theme.cpp:974-986`): wide margins, square corners. */
function tabBoxes(scale: number): Readonly<Record<string, DefaultStyleBox>> {
  const tab = (color: Rgba): DefaultFlatStyleBox =>
    makeFlatStyleBox(scale, color, { margin: { left: 10, top: 4, right: 10, bottom: 4 }, cornerRadius: 0 });
  const selected = withBorder(
    tab(STYLE_FILL.normal),
    { left: 0, top: scaledPx(2, scale), right: 0, bottom: 0 },
    STYLE_FILL.focus
  );
  const sideBorder = scaledPx(1, scale);
  const unselected = withBorder(
    tab(STYLE_FILL.pressed),
    { left: sideBorder, top: 0, right: sideBorder, bottom: 0 },
    POPUP_BORDER_COLOR
  );
  return {
    tab_selected: selected,
    tab_hovered: { ...unselected, bgColor: TAB_HOVERED_FILL },
    tab_unselected: unselected,
    tab_disabled: { ...unselected, bgColor: STYLE_FILL.disabled },
    tab_focus: focusStyleBox(scale),
  };
}

const TAB_COLORS: Readonly<Record<string, Rgba>> = {
  font_selected_color: CONTROL_FONT_HOVER_COLOR,
  font_hovered_color: CONTROL_FONT_HOVER_COLOR,
  font_unselected_color: CONTROL_FONT_LOW_COLOR,
  font_disabled_color: CONTROL_FONT_DISABLED_COLOR,
  font_outline_color: BLACK,
  drop_mark_color: WHITE,
  icon_selected_color: WHITE,
  icon_hovered_color: WHITE,
  icon_unselected_color: WHITE,
  icon_disabled_color: WHITE,
};

export function tabTypes(scale: number): DefaultThemeTypes {
  const tabs = tabBoxes(scale);
  const { normal, pressed } = buttonBoxes(scale);
  const tabContainer: DefaultThemeType = typeItems({
    styles: {
      ...tabs,
      panel: flatPanelStyleBox(scale),
      tabbar_background: makeEmptyStyleBox(scale, allSides(0)),
    },
    colors: TAB_COLORS,
    constants: {
      side_margin: scaledPx(8, scale),
      icon_separation: scaledPx(4, scale),
      icon_max_width: 0,
      outline_size: 0,
    },
  });
  const tabBar: DefaultThemeType = typeItems({
    styles: { ...tabs, button_pressed: pressed, button_highlight: normal },
    colors: TAB_COLORS,
    constants: {
      h_separation: scaledPx(4, scale),
      icon_max_width: 0,
      outline_size: 0,
      hover_switch_wait_msec: 500,
    },
  });
  return { TabContainer: tabContainer, TabBar: tabBar };
}
