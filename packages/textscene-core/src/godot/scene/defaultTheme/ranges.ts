/**
 * The default theme's Range Controls (`scene/theme/default_theme.cpp:438-449`, `:540-650`): HScrollBar,
 * VScrollBar, HSlider, VSlider, ProgressBar and SpinBox.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Rgba } from '../../math/math.js';
import {
  CONTROL_FONT_COLOR,
  CONTROL_FONT_DISABLED_COLOR,
  CONTROL_FONT_HOVER_COLOR,
  STYLE_FILL,
} from '../theme.js';
import { buttonBoxes, focusStyleBox } from './button.js';
import type { DefaultFlatStyleBox, DefaultThemeType, DefaultThemeTypes, Sides } from './defaultTheme.js';
import { allSides, makeEmptyStyleBox, makeFlatStyleBox } from './styleBoxes.js';
import { BLACK, typeItems } from './typeItems.js';

/** `style_focus_color * Color(0.75, 0.75, 0.75)` (`default_theme.cpp:546`): the alpha stays. */
const SCROLL_GRABBER_PRESSED: Rgba = { r: 0.75, g: 0.75, b: 0.75, a: STYLE_FILL.focus.a };

/** The radius of every scroll bar box (`default_theme.cpp:542-546`). */
const SCROLL_BAR_RADIUS = 10;

/** The radius of every slider box (`default_theme.cpp:579-581`). */
const SLIDER_RADIUS = 4;

/** The radius of both ProgressBar boxes (`default_theme.cpp:440-441`). */
const PROGRESS_BAR_RADIUS = 6;

function scrollBar(scale: number, scrollMargin: Sides): DefaultThemeType {
  const box = (color: Rgba, margin: Sides): DefaultFlatStyleBox =>
    makeFlatStyleBox(scale, color, { margin, cornerRadius: SCROLL_BAR_RADIUS });
  return typeItems({
    styles: {
      scroll: box(STYLE_FILL.normal, scrollMargin),
      scroll_focus: focusStyleBox(scale),
      grabber: box(STYLE_FILL.progress, allSides(4)),
      grabber_highlight: box(STYLE_FILL.focus, allSides(4)),
      grabber_pressed: box(SCROLL_GRABBER_PRESSED, allSides(4)),
    },
  });
}

function slider(scale: number): DefaultThemeType {
  const box = (color: Rgba) =>
    makeFlatStyleBox(scale, color, { margin: allSides(4), cornerRadius: SLIDER_RADIUS });
  return typeItems({
    styles: {
      slider: box(STYLE_FILL.normal),
      grabber_area: box(STYLE_FILL.progress),
      grabber_area_highlight: box(STYLE_FILL.focus),
    },
    constants: { center_grabber: 0, grabber_offset: 0, tick_offset: 0 },
  });
}

function progressBar(scale: number): DefaultThemeType {
  const box = (color: Rgba) =>
    makeFlatStyleBox(scale, color, { margin: allSides(2), cornerRadius: PROGRESS_BAR_RADIUS });
  return typeItems({
    styles: { background: box(STYLE_FILL.disabled), fill: box(STYLE_FILL.progress) },
    colors: { font_color: CONTROL_FONT_HOVER_COLOR, font_outline_color: BLACK },
    constants: { outline_size: 0 },
  });
}

/** SpinBox's up and down buttons share their boxes and colours (`default_theme.cpp:625-641`). */
function spinBox(scale: number): DefaultThemeType {
  const { hover, pressed } = buttonBoxes(scale);
  const styles: Record<string, DefaultFlatStyleBox | ReturnType<typeof makeEmptyStyleBox>> = {
    field_and_buttons_separator: makeEmptyStyleBox(scale),
    up_down_buttons_separator: makeEmptyStyleBox(scale),
  };
  const colors: Record<string, Rgba> = {};
  for (const button of ['up', 'down']) {
    styles[`${button}_background`] = makeEmptyStyleBox(scale);
    styles[`${button}_background_hovered`] = hover;
    styles[`${button}_background_pressed`] = pressed;
    styles[`${button}_background_disabled`] = makeEmptyStyleBox(scale);
    colors[`${button}_icon_modulate`] = CONTROL_FONT_COLOR;
    colors[`${button}_hover_icon_modulate`] = CONTROL_FONT_HOVER_COLOR;
    colors[`${button}_pressed_icon_modulate`] = CONTROL_FONT_HOVER_COLOR;
    colors[`${button}_disabled_icon_modulate`] = CONTROL_FONT_DISABLED_COLOR;
  }
  return typeItems({
    styles,
    colors,
    constants: {
      buttons_vertical_separation: 0,
      field_and_buttons_separation: 2,
      buttons_width: 16,
      set_min_buttons_width_from_icons: 1,
    },
  });
}

export function rangeTypes(scale: number): DefaultThemeTypes {
  const sliderType = slider(scale);
  return {
    HScrollBar: scrollBar(scale, { left: 0, top: 4, right: 0, bottom: 4 }),
    VScrollBar: scrollBar(scale, { left: 4, top: 0, right: 4, bottom: 0 }),
    HSlider: sliderType,
    VSlider: sliderType,
    ProgressBar: progressBar(scale),
    SpinBox: spinBox(scale),
  };
}
