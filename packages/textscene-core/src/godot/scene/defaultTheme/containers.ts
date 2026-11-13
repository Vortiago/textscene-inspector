/**
 * The default theme's containers, panels and separators (`scene/theme/default_theme.cpp:133-134`,
 * `:653-670`, `:734-740`, `:1066-1069`, `:1165-1168`, `:1236-1323`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rgba } from '../../math/math.js';
import {
  CONTROL_FONT_COLOR,
  CONTROL_FONT_HOVER_COLOR,
  CONTROL_FONT_PRESSED_COLOR,
  DEFAULT_CONTENT_MARGIN,
  DEFAULT_FONT_SIZE,
  scaledPx,
  STYLE_FILL,
} from '../theme.js';
import type {
  DefaultFlatStyleBox,
  DefaultLineStyleBox,
  DefaultThemeType,
  DefaultThemeTypes,
} from './defaultTheme.js';
import {
  allSides,
  emptyStyleBox,
  makeEmptyStyleBox,
  makeFlatStyleBox,
  withBorder,
  withCornerRadius,
  withExpandMargin,
} from './styleBoxes.js';
import { BLACK, typeItems, WHITE } from './typeItems.js';

/** `style_separator_color` (`default_theme.cpp:124`). */
const SEPARATOR_COLOR: Rgba = { r: 0.5, g: 0.5, b: 0.5, a: 1 };

/** TooltipPanel's fill (`default_theme.cpp:1169`). */
const TOOLTIP_FILL: Rgba = { r: 0, g: 0, b: 0, a: 0.5 };

/** `Color(1, 1, 1, a)`: SplitContainer's touch dragger in each state (`default_theme.cpp:1238-1240`). */
const whiteAt = (a: number): Rgba => ({ r: 1, g: 1, b: 1, a });

/**
 * `make_flat_stylebox(style_normal_color, 0, 0, 0, 0)`: the `panel` of Panel, PanelContainer and
 * TabContainer (`default_theme.cpp:134,993,1274`).
 */
export function flatPanelStyleBox(scale: number): DefaultFlatStyleBox {
  return makeFlatStyleBox(scale, STYLE_FILL.normal, { margin: allSides(0) });
}

function panelOf(scale: number): DefaultThemeType {
  return typeItems({ styles: { panel: flatPanelStyleBox(scale) } });
}

/**
 * `separator_horizontal` and its vertical twin (`default_theme.cpp:734-740`): `set_content_margin_individual`
 * takes `default_margin` unscaled, and only the thickness scales. HSeparator, VSeparator and PopupMenu share it.
 */
export function separatorLine(scale: number, vertical: boolean): DefaultLineStyleBox {
  const along = vertical
    ? { left: 0, top: 4, right: 0, bottom: 4 }
    : { left: 4, top: 0, right: 4, bottom: 0 };
  return {
    kind: 'line',
    color: SEPARATOR_COLOR,
    thickness: scaledPx(1, scale),
    vertical,
    growBegin: 1,
    growEnd: 1,
    contentMargin: along,
  };
}

function separator(scale: number, vertical: boolean): DefaultThemeType {
  return typeItems({
    styles: { separator: separatorLine(scale, vertical) },
    constants: { separation: scaledPx(4, scale) },
  });
}

/** One type with these constants and no other item. */
const constantsOnly = (constants: Readonly<Record<string, number>>) => typeItems({ constants });

function splitContainer(scale: number, colors: Readonly<Record<string, Rgba>> = {}): DefaultThemeType {
  return typeItems({
    styles: { split_bar_background: makeEmptyStyleBox(scale, allSides(0)) },
    colors,
    constants: {
      separation: scaledPx(12, scale),
      minimum_grab_thickness: scaledPx(6, scale),
      autohide: 1,
    },
  });
}

/** `focus_style` (`default_theme.cpp:659-664`): a ring of `style_focus_color`, flush outside the content. */
function scrollContainer(scale: number): DefaultThemeType {
  const ring = makeFlatStyleBox(scale, STYLE_FILL.focus, { drawCenter: false });
  const focus = withBorder(
    withExpandMargin(ring, scale, allSides(4)),
    allSides(scaledPx(2, scale)),
    STYLE_FILL.focus
  );
  return typeItems({
    styles: { panel: emptyStyleBox(), focus },
    colors: { scroll_hint_vertical_color: BLACK, scroll_hint_horizontal_color: BLACK },
  });
}

/**
 * FoldableContainer (`default_theme.cpp:1286-1323`). The title boxes lose their bottom corners and the panel
 * its top ones, unscaled. The panel's `set_content_margin_all(default_margin)` and the font size are unscaled too.
 */
function foldableContainer(scale: number): DefaultThemeType {
  const flat = (color: Rgba) => makeFlatStyleBox(scale, color);
  const title = (color: Rgba) => withCornerRadius(flat(color), { bottomLeft: 0, bottomRight: 0 });
  const panel = withCornerRadius(
    { ...flat(STYLE_FILL.normal), contentMargin: allSides(DEFAULT_CONTENT_MARGIN) },
    { topLeft: 0, topRight: 0 }
  );
  return typeItems({
    styles: {
      title_panel: title(STYLE_FILL.pressed),
      title_hover_panel: title(STYLE_FILL.hover),
      title_collapsed_panel: flat(STYLE_FILL.pressed),
      title_collapsed_hover_panel: flat(STYLE_FILL.hover),
      panel,
      focus: makeFlatStyleBox(scale, STYLE_FILL.focus, { drawCenter: false, borderWidth: 2 }),
    },
    fontSizes: { font_size: DEFAULT_FONT_SIZE },
    colors: {
      font_color: CONTROL_FONT_COLOR,
      hover_font_color: CONTROL_FONT_HOVER_COLOR,
      collapsed_font_color: CONTROL_FONT_PRESSED_COLOR,
      font_outline_color: WHITE,
    },
    constants: { outline_size: 0, h_separation: scaledPx(2, scale) },
  });
}

export function containerTypes(scale: number): DefaultThemeTypes {
  const separation = constantsOnly({ separation: scaledPx(4, scale) });
  const grid = constantsOnly({ h_separation: scaledPx(4, scale), v_separation: scaledPx(4, scale) });
  const split = splitContainer(scale);
  return {
    Panel: panelOf(scale),
    PanelContainer: panelOf(scale),
    TooltipPanel: typeItems({
      styles: {
        panel: makeFlatStyleBox(scale, TOOLTIP_FILL, { margin: { left: 8, top: 2, right: 8, bottom: 2 } }),
      },
    }),
    BoxContainer: separation,
    HBoxContainer: separation,
    VBoxContainer: separation,
    GridContainer: grid,
    FlowContainer: grid,
    HFlowContainer: grid,
    VFlowContainer: grid,
    MarginContainer: constantsOnly({ margin_left: 0, margin_top: 0, margin_right: 0, margin_bottom: 0 }),
    SplitContainer: splitContainer(scale, {
      touch_dragger_color: whiteAt(0.3),
      touch_dragger_pressed_color: whiteAt(1),
      touch_dragger_hover_color: whiteAt(0.6),
    }),
    HSplitContainer: split,
    VSplitContainer: split,
    ScrollContainer: scrollContainer(scale),
    FoldableContainer: foldableContainer(scale),
    HSeparator: separator(scale, false),
    VSeparator: separator(scale, true),
  };
}
