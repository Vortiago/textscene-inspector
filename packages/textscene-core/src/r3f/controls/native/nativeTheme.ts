/**
 * `NativeTheme` — the default-theme data the native (WebGL) Control solver and
 * painters read, extending `ScaledGodotTheme` (`../godotDefaultTheme.ts`, kept
 * framework-free on purpose) with the numeric StyleBoxFlat fill colours the
 * DOM overlay only ever needed as CSS strings.
 *
 * `scaledGodotTheme(scale)` is NOT re-transcribed here — every scalable
 * metric (font size, corner radius, margins, separation, slider geometry)
 * passes through unchanged. What's added is genuinely new for this renderer:
 * the default flat stylebox's fill colour per draw state, as raw
 * `Color(r, g, b, a)` components (0..1 floats) rather than the `rgba(...)`
 * CSS strings `godotDefaultTheme.ts` exports, because the native painter
 * multiplies vertex colours instead of setting a CSS background.
 *
 * Colours are NOT scaled — `default_theme_scale` only affects geometry
 * (`scene/theme/default_theme.cpp::fill_default_theme` scales every length it
 * passes to `make_flat_stylebox`, never a `Color` literal).
 *
 * `widgets` (this packet, P5) composes per-widget `StyleBoxFlatData` structs
 * FROM `STYLE_FILL` and `scaledGodotTheme`'s already-scaled numbers — never
 * re-transcribing a colour literal, and reusing `contentMargin`/`cornerRadius`
 * wherever a widget's own `scene/theme/default_theme.cpp` call site passes
 * the SAME underlying constant (`default_margin` = 4, `default_corner_radius`
 * = 3) that those two fields are already `Math.round(x * scale)` of. A widget
 * whose own call passes a DIFFERENT literal (ScrollBar's `10`) gets its own
 * `Math.round(10 * scale)`, cited against its own call site below.
 */

import type { ControlColor } from '../../../nodes/2d/ui/control/types';
import { scaledGodotTheme, STYLE_FILL, type ScaledGodotTheme } from '../godotDefaultTheme';
import type { StyleBoxFlatData } from './styleBoxFlat';

/**
 * The default flat stylebox's fill, by draw state — `scene/theme/default_theme.cpp`,
 * `fill_default_theme`:
 *  - `style_normal_color` = `Color(0.1, 0.1, 0.1, 0.6)`.
 *  - `style_hover_color` = `Color(0.225, 0.225, 0.225, 0.6)`.
 *  - `style_pressed_color` = `Color(0, 0, 0, 0.6)`.
 *  - `style_disabled_color` = `Color(0.1, 0.1, 0.1, 0.3)`.
 *  - `style_popup_color` = `Color(0.25, 0.25, 0.25, 1)`.
 *  - `style_progress_color` = `Color(1, 1, 1, 0.4)` (the sliders' filled
 *    `grabber_area`).
 */
export interface NativeThemeStyleFill {
  normal: ControlColor;
  hover: ControlColor;
  pressed: ControlColor;
  disabled: ControlColor;
  popup: ControlColor;
  progress: ControlColor;
}

/** `StyleBoxFlat`'s own default, unset by any `make_flat_stylebox` call (`style_box_flat.h:40`). */
const DEFAULT_BORDER_COLOR: ControlColor = { r: 0.8, g: 0.8, b: 0.8, a: 1 };

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };

/**
 * `make_flat_stylebox` (`default_theme.cpp:57-70`), restricted to what
 * `StyleBoxFlatData` models: every input here is ALREADY the scaled,
 * rounded number the caller wants (`Math.round(x * scale)`), so this helper
 * never scales — it only assembles the struct. `border_color`/`expand_margin`/
 * `border_blend` are never touched by `make_flat_stylebox`, so they stay at
 * `StyleBoxFlat`'s own defaults; `draw_center` defaults true and no widget
 * built here overrides it (Button's "focus" stylebox does, but focus styles
 * are out of this packet's scope).
 */
function flatStyleBox(
  bgColor: ControlColor,
  contentMargin: { left: number; top: number; right: number; bottom: number },
  cornerRadius: number
): StyleBoxFlatData {
  return {
    bgColor,
    borderColor: DEFAULT_BORDER_COLOR,
    borderWidth: ZERO_SIDES,
    cornerRadius: {
      topLeft: cornerRadius,
      topRight: cornerRadius,
      bottomRight: cornerRadius,
      bottomLeft: cornerRadius,
    },
    expandMargin: ZERO_SIDES,
    contentMargin,
    drawCenter: true,
    borderBlend: false,
  };
}

/**
 * The default-theme StyleBoxFlat structs later packets (Panel/Button/
 * ScrollBar/ScrollContainer) compose their Controls from.
 */
export interface NativeThemeWidgets {
  panel: StyleBoxFlatData;
  button: {
    normal: StyleBoxFlatData;
    hover: StyleBoxFlatData;
    pressed: StyleBoxFlatData;
    disabled: StyleBoxFlatData;
  };
  scrollBar: {
    /** HScrollBar's "scroll" (track) stylebox — `style_h_scrollbar`, `default_theme.cpp:543`. */
    scrollHorizontal: StyleBoxFlatData;
    /** VScrollBar's "scroll" (track) stylebox — `style_v_scrollbar`, `default_theme.cpp:544`: the same box, transposed. */
    scrollVertical: StyleBoxFlatData;
    /** `style_scrollbar_grabber`, `default_theme.cpp:545` — identical for HScrollBar and VScrollBar. */
    grabber: StyleBoxFlatData;
  };
}

export interface NativeTheme extends ScaledGodotTheme {
  styleFill: NativeThemeStyleFill;
  widgets: NativeThemeWidgets;
}

/** ScrollBar's own corner radius (`default_theme.cpp:543-545` pass `10`, not `default_corner_radius`). */
const SCROLL_BAR_CORNER_RADIUS = 10;

/** `NativeTheme` at a project's `gui/theme/default_theme_scale`. */
export function nativeTheme(scale: number): NativeTheme {
  const scaled = scaledGodotTheme(scale);
  const buttonMargin = {
    left: scaled.contentMargin,
    top: scaled.contentMargin,
    right: scaled.contentMargin,
    bottom: scaled.contentMargin,
  };
  const scrollBarCornerRadius = Math.round(SCROLL_BAR_CORNER_RADIUS * scale);

  return {
    ...scaled,
    styleFill: STYLE_FILL,
    widgets: {
      // default_theme.cpp:134: make_flat_stylebox(style_normal_color, 0, 0, 0, 0).
      panel: flatStyleBox(STYLE_FILL.normal, ZERO_SIDES, scaled.cornerRadius),
      button: {
        // default_theme.cpp:138-141: make_flat_stylebox(color) — every default arg.
        normal: flatStyleBox(STYLE_FILL.normal, buttonMargin, scaled.cornerRadius),
        hover: flatStyleBox(STYLE_FILL.hover, buttonMargin, scaled.cornerRadius),
        pressed: flatStyleBox(STYLE_FILL.pressed, buttonMargin, scaled.cornerRadius),
        disabled: flatStyleBox(STYLE_FILL.disabled, buttonMargin, scaled.cornerRadius),
      },
      scrollBar: {
        scrollHorizontal: flatStyleBox(
          STYLE_FILL.normal,
          { left: 0, top: scaled.contentMargin, right: 0, bottom: scaled.contentMargin },
          scrollBarCornerRadius
        ),
        scrollVertical: flatStyleBox(
          STYLE_FILL.normal,
          { left: scaled.contentMargin, top: 0, right: scaled.contentMargin, bottom: 0 },
          scrollBarCornerRadius
        ),
        grabber: flatStyleBox(STYLE_FILL.progress, buttonMargin, scrollBarCornerRadius),
      },
    },
  };
}
