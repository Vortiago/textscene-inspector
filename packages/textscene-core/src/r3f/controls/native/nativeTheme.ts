/**
 * The default-theme data the native Control solver and painters read:
 * `ScaledGodotTheme` unchanged, plus the StyleBoxFlat fill colours as 0..1
 * `Color` components, because a native painter multiplies vertex colours
 * rather than setting a CSS `rgba(...)` background.
 */

import type { ControlColor } from '../../../nodes/2d/ui/control/types';
import { flatStyleBox as makeFlatStyleBox } from './styleBoxFlat';
import { LINE_EDIT_BORDER_BOTTOM_WIDTH, scaledGodotTheme, STYLE_FILL, type ScaledGodotTheme } from '../godotDefaultTheme';
import type { StyleBoxFlatData } from './styleBoxFlat';

/**
 * The default flat stylebox's fill by draw state, from `scene/theme/default_theme.cpp`'s
 * `fill_default_theme`, which scales every length it passes to `make_flat_stylebox` but never a
 * `Color` literal, so the colours are not scaled.
 */
export interface NativeThemeStyleFill {
  /** `style_normal_color` = `Color(0.1, 0.1, 0.1, 0.6)`. */
  normal: ControlColor;
  /** `style_hover_color` = `Color(0.225, 0.225, 0.225, 0.6)`. */
  hover: ControlColor;
  /** `style_pressed_color` = `Color(0, 0, 0, 0.6)`. */
  pressed: ControlColor;
  /** `style_disabled_color` = `Color(0.1, 0.1, 0.1, 0.3)`. */
  disabled: ControlColor;
  /** `style_popup_color` = `Color(0.25, 0.25, 0.25, 1)`. */
  popup: ControlColor;
  /** `style_progress_color` = `Color(1, 1, 1, 0.4)`, the sliders' filled `grabber_area`. */
  progress: ControlColor;
}

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };

/**
 * `make_flat_stylebox` (`default_theme.cpp:57-70`) for the fields
 * `StyleBoxFlatData` models. Every input is already scaled and rounded, so this
 * never scales. The fields `make_flat_stylebox` leaves alone keep `StyleBoxFlat`'s
 * defaults, and no widget here overrides `draw_center` (only a focus style does).
 */
function flatStyleBox(
  bgColor: ControlColor,
  contentMargin: { left: number; top: number; right: number; bottom: number },
  cornerRadius: number
): StyleBoxFlatData {
  return makeFlatStyleBox(bgColor, { contentMargin, cornerRadius });
}

/**
 * LineEdit's `normal`/`read_only` styleboxes (`default_theme.cpp:405-417`):
 * `make_flat_stylebox(fill)` plus a bottom border set directly with
 * `set_border_width(SIDE_BOTTOM, 2)`. The border bypasses `make_flat_stylebox`,
 * so its width is a bare `2`, never `Math.round(2 * scale)`.
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

/** `style_pressed_color` (`default_theme.cpp:115`): LineEdit `normal`'s bottom-border colour (`:408`). */
const LINE_EDIT_NORMAL_BORDER_COLOR: ControlColor = { r: 0, g: 0, b: 0, a: 0.6 };

/** `style_pressed_color * Color(1, 1, 1, 0.5)` (`default_theme.cpp:416`): `read_only`'s bottom-border colour. */
const LINE_EDIT_READ_ONLY_BORDER_COLOR: ControlColor = { r: 0, g: 0, b: 0, a: 0.3 };

/**
 * The default-theme StyleBoxFlat structs the Panel/Button/ScrollBar/
 * ScrollContainer Controls compose from.
 */
export interface NativeThemeWidgets {
  panel: StyleBoxFlatData;
  button: {
    normal: StyleBoxFlatData;
    hover: StyleBoxFlatData;
    pressed: StyleBoxFlatData;
    disabled: StyleBoxFlatData;
  };
  /** LineEdit's `normal`/`read_only` styleboxes, `default_theme.cpp:405-417`. */
  lineEdit: {
    normal: StyleBoxFlatData;
    readOnly: StyleBoxFlatData;
  };
  /**
   * `sb_optbutton_normal`/`sb_optbutton_disabled` (`default_theme.cpp:212-215`):
   * the shared corner radius with OptionButton's own asymmetric X and Y margins.
   * A static preview has no pointer, so hover and pressed never arise.
   */
  optionButton: {
    normal: StyleBoxFlatData;
    disabled: StyleBoxFlatData;
  };
  /**
   * HSlider/VSlider's `slider` (track) and `grabber_area` (fill), both
   * `make_flat_stylebox(color, 4, 4, 4, 4, 4)` (`default_theme.cpp:579-580`).
   * `contentMargin` stays zero: the solver takes thickness from `sliderTrackThickness`.
   */
  slider: {
    track: StyleBoxFlatData;
    fill: StyleBoxFlatData;
  };
  scrollBar: {
    /** HScrollBar's "scroll" (track) stylebox, `style_h_scrollbar`, `default_theme.cpp:543`. */
    scrollHorizontal: StyleBoxFlatData;
    /** VScrollBar's "scroll" (track) stylebox, `style_v_scrollbar`, `default_theme.cpp:544`: the same box, transposed. */
    scrollVertical: StyleBoxFlatData;
    /** `style_scrollbar_grabber`, `default_theme.cpp:545`, for both orientations. */
    grabber: StyleBoxFlatData;
  };
  /**
   * SplitContainer's theme entries (`default_theme.cpp:1258-1266`) hold no
   * stylebox: the grabber is an icon (`native/themeIcons.ts`'s
   * `SPLIT_CONTAINER_ICONS`), and `split_bar_background` (`:1275-1277`) is empty.
   */
  splitContainer: {
    // No `minimum_grab_thickness` (`:1261-1263`): it only enlarges the mouse drag
    // hitbox (`split_container.cpp:764-778`), and dragging is not modelled.
    /** `separation` (`default_theme.cpp:1258-1260`), floored by the grabber icon's extent at the call site (`shared/splitContainerSolver.ts`'s `separationOf`, mirroring `SplitContainer::_get_separation`, `split_container.cpp:305-316`). */
    separation: number;
    /** The grabber icon's extent along the split axis (`native/themeIcons.ts`). It scales with the theme, since `generate_icon` rasterises through the same scale. */
    grabberExtent: number;
    /** `autohide` (`default_theme.cpp:1264-1266`): a 0/1 theme constant, not scaled. True hides the grabber icon without a hover or drag state (`shared/splitContainerSolver.ts`'s `isSplitGrabberVisible`). */
    autohide: boolean;
  };
}

export interface NativeTheme extends ScaledGodotTheme {
  styleFill: NativeThemeStyleFill;
  widgets: NativeThemeWidgets;
}

/** ScrollBar's own corner radius (`default_theme.cpp:543-545` pass `10`, not `default_corner_radius`). */
const SCROLL_BAR_CORNER_RADIUS = 10;

/** SplitContainer's own `separation` (`default_theme.cpp:1258-1260` pass `12`, not BoxContainer's `4`). */
const SPLIT_CONTAINER_SEPARATION = 12;

/** `hsplitter.svg`/`vsplitter.svg`'s short dimension (`scene/theme/icons/`): 8px along the split axis, 48px across it. */
const SPLIT_CONTAINER_GRABBER_EXTENT = 8;

/** `autohide` (`default_theme.cpp:1264-1266`). */
const SPLIT_CONTAINER_AUTOHIDE = true;

// A widget reuses `contentMargin`/`cornerRadius` where its `default_theme.cpp` call passes
// `default_margin` (4) or `default_corner_radius` (3). A call passing another
// literal, such as ScrollBar's 10, gets its own scaled constant.
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
        // default_theme.cpp:138-141: make_flat_stylebox(color), every default arg.
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
        // default_margin, 2*default_margin, default_margin): X and Y differ.
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
