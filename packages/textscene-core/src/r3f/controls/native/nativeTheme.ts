/**
 * `NativeTheme` — the default-theme data the native (WebGL) Control solver and
 * painters read, extending `ScaledGodotTheme` (`../godotDefaultTheme.ts`, kept
 * framework-free on purpose) with the numeric StyleBoxFlat fill colours a
 * native painter needs (`godotDefaultTheme.ts` only exports them as CSS
 * strings).
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
import { LINE_EDIT_BORDER_BOTTOM_WIDTH, scaledGodotTheme, STYLE_FILL, type ScaledGodotTheme } from '../godotDefaultTheme';
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
 * `border_blend`/`anti_aliased`/`aa_size`/`corner_detail` are never touched
 * by `make_flat_stylebox`, so they stay at `StyleBoxFlat`'s own defaults;
 * `draw_center` defaults true and no widget built here overrides it (Button's
 * "focus" stylebox does, but focus styles are out of this packet's scope).
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
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
  };
}

/**
 * LineEdit's own `normal`/`read_only` styleboxes (`default_theme.cpp:405-417`):
 * `make_flat_stylebox(fill)` — same scaled margin/radius `flatStyleBox` above
 * already produces for Button — PLUS a bottom border Godot sets directly on
 * the built box via `set_border_width(SIDE_BOTTOM, 2)`/`set_border_color`,
 * bypassing `make_flat_stylebox` entirely. That is why the border width is a
 * bare `2`, never `Math.round(2 * scale)`: the comment above `make_flat_stylebox`
 * in `default_theme.cpp` scales every length it's ROUTED THROUGH, and this
 * call never routes the border through it.
 */
function lineEditStyleBox(
  bgColor: ControlColor,
  borderColor: ControlColor,
  contentMargin: { left: number; top: number; right: number; bottom: number },
  cornerRadius: number
): StyleBoxFlatData {
  return {
    ...flatStyleBox(bgColor, contentMargin, cornerRadius),
    borderColor,
    borderWidth: { left: 0, top: 0, right: 0, bottom: LINE_EDIT_BORDER_BOTTOM_WIDTH },
  };
}

/** `style_pressed_color` (`default_theme.cpp:115`) — LineEdit `normal`'s own bottom-border colour (`:408`). */
const LINE_EDIT_NORMAL_BORDER_COLOR: ControlColor = { r: 0, g: 0, b: 0, a: 0.6 };

/** `style_pressed_color * Color(1, 1, 1, 0.5)` (`default_theme.cpp:416`) — `read_only`'s own bottom-border colour, half `normal`'s alpha. */
const LINE_EDIT_READ_ONLY_BORDER_COLOR: ControlColor = { r: 0, g: 0, b: 0, a: 0.3 };

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
  /** LineEdit's own `normal`/`read_only` styleboxes — `default_theme.cpp:405-417`. */
  lineEdit: {
    normal: StyleBoxFlatData;
    readOnly: StyleBoxFlatData;
  };
  /**
   * `sb_optbutton_normal`/`sb_optbutton_disabled` (`default_theme.cpp:212-215`):
   * the same corner radius as every other default-theme flat stylebox, with
   * content margins unique to OptionButton (asymmetric X vs Y). Only the two
   * states `ButtonDrawState` can select in a pointer-less static preview are
   * built — hover/pressed never arise.
   */
  optionButton: {
    normal: StyleBoxFlatData;
    disabled: StyleBoxFlatData;
  };
  /**
   * HSlider/VSlider's `slider` (track) and `grabber_area` (fill) styleboxes —
   * `make_flat_stylebox(color, 4, 4, 4, 4, 4)` (`default_theme.cpp:579-580`),
   * the identical shape for both orientations. `contentMargin` stays zero:
   * on-screen thickness comes from `sliderTrackThickness` via the solver's
   * rect math, never from summing this struct's margins.
   */
  slider: {
    track: StyleBoxFlatData;
    fill: StyleBoxFlatData;
  };
  scrollBar: {
    /** HScrollBar's "scroll" (track) stylebox — `style_h_scrollbar`, `default_theme.cpp:543`. */
    scrollHorizontal: StyleBoxFlatData;
    /** VScrollBar's "scroll" (track) stylebox — `style_v_scrollbar`, `default_theme.cpp:544`: the same box, transposed. */
    scrollVertical: StyleBoxFlatData;
    /** `style_scrollbar_grabber`, `default_theme.cpp:545` — identical for HScrollBar and VScrollBar. */
    grabber: StyleBoxFlatData;
  };
  /**
   * SplitContainer/HSplitContainer/VSplitContainer's own theme entries
   * (`default_theme.cpp:1258-1266`) — no `StyleBoxFlatData` here at all: the
   * grabber is drawn from an ICON (`native/themeIcons.ts`'s
   * `SPLIT_CONTAINER_ICONS`, `hsplitter.svg`/`vsplitter.svg`), and
   * `split_bar_background` (`:1275-1277`) is an EMPTY stylebox that draws
   * nothing, so there is no fill to model. `minimum_grab_thickness`
   * (`:1261-1263`) is deliberately NOT reproduced here — it only enlarges the
   * INVISIBLE mouse drag hitbox (`SplitContainer::_resort`'s
   * `dragging_area_controls[i]->set_rect`, `split_container.cpp:764-778`),
   * never the separation band or the icon's own placement, and dragging is
   * this packet's explicit non-goal.
   */
  splitContainer: {
    /** `separation` (`default_theme.cpp:1258-1260`) — floored by the grabber icon's own extent at the call site (`shared/splitContainerSolver.ts`'s `separationOf`, mirroring `SplitContainer::_get_separation`, `split_container.cpp:305-316`). */
    separation: number;
    /** The grabber icon's extent along the split axis (`hsplitter.svg`/`vsplitter.svg`'s short dimension, both 8×1 at scale 1 — see `native/themeIcons.ts`). Icons scale with the theme like every other metric here (`generate_icon` rasterises through the same scale). */
    grabberExtent: number;
    /** `autohide` (`default_theme.cpp:1264-1266`) — a THEME CONSTANT (0/1), not a stylebox. Default true hides the grabber icon absent a hover/drag state; see `shared/splitContainerSolver.ts`'s `isSplitGrabberVisible` for what that means for a static previewer. NOT scaled — it is a boolean flag, not a length. */
    autohide: boolean;
  };
}

export interface NativeTheme extends ScaledGodotTheme {
  styleFill: NativeThemeStyleFill;
  widgets: NativeThemeWidgets;
}

/** ScrollBar's own corner radius (`default_theme.cpp:543-545` pass `10`, not `default_corner_radius`). */
const SCROLL_BAR_CORNER_RADIUS = 10;

/** SplitContainer/HSplitContainer/VSplitContainer's own `separation` (`default_theme.cpp:1258-1260` pass `12`, not `default_theme.cpp`'s BoxContainer `separation` of `4`). */
const SPLIT_CONTAINER_SEPARATION = 12;

/** `hsplitter.svg`/`vsplitter.svg`'s own short dimension (`scene/theme/icons/`) — both authored at 8px along the split axis, 48px across it. */
const SPLIT_CONTAINER_GRABBER_EXTENT = 8;

/** `autohide` (`default_theme.cpp:1264-1266`) — a plain boolean theme constant, not scaled. */
const SPLIT_CONTAINER_AUTOHIDE = true;

/** `NativeTheme` at a project's `gui/theme/default_theme_scale`. */
export function nativeTheme(scale: number): NativeTheme {
  const scaled = scaledGodotTheme(scale);
  const buttonMargin = {
    left: scaled.contentMargin,
    top: scaled.contentMargin,
    right: scaled.contentMargin,
    bottom: scaled.contentMargin,
  };
  const optionButtonMargin = {
    left: scaled.optionButtonMarginX,
    top: scaled.optionButtonMarginY,
    right: scaled.optionButtonMarginX,
    bottom: scaled.optionButtonMarginY,
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
      lineEdit: {
        // default_theme.cpp:405-409: make_flat_stylebox(style_normal_color) + border.
        normal: lineEditStyleBox(
          STYLE_FILL.normal,
          LINE_EDIT_NORMAL_BORDER_COLOR,
          buttonMargin,
          scaled.cornerRadius
        ),
        // default_theme.cpp:413-417: make_flat_stylebox(style_disabled_color) + border.
        readOnly: lineEditStyleBox(
          STYLE_FILL.disabled,
          LINE_EDIT_READ_ONLY_BORDER_COLOR,
          buttonMargin,
          scaled.cornerRadius
        ),
      },
      optionButton: {
        // default_theme.cpp:212-215: make_flat_stylebox(color, 2*default_margin,
        // default_margin, 2*default_margin, default_margin) — X and Y differ.
        normal: flatStyleBox(STYLE_FILL.normal, optionButtonMargin, scaled.cornerRadius),
        disabled: flatStyleBox(STYLE_FILL.disabled, optionButtonMargin, scaled.cornerRadius),
      },
      slider: {
        // default_theme.cpp:579-580: make_flat_stylebox(color, 4, 4, 4, 4, 4) for
        // both `slider` and `grabber_area`; margins are never read back off these.
        track: flatStyleBox(STYLE_FILL.normal, ZERO_SIDES, scaled.sliderCornerRadius),
        fill: flatStyleBox(STYLE_FILL.progress, ZERO_SIDES, scaled.sliderCornerRadius),
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
      splitContainer: {
        separation: Math.round(SPLIT_CONTAINER_SEPARATION * scale),
        grabberExtent: Math.round(SPLIT_CONTAINER_GRABBER_EXTENT * scale),
        autohide: SPLIT_CONTAINER_AUTOHIDE,
      },
    },
  };
}
