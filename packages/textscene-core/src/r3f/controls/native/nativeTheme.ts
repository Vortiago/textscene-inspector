/**
 * The default-theme data the native Control solver and painters read:
 * `ScaledGodotTheme` unchanged, plus the StyleBoxFlat fill colours as 0..1
 * `Color` components, because a native painter multiplies vertex colours
 * rather than setting a CSS `rgba(...)` background.
 */

import { flatStyleBox as makeFlatStyleBox, freezeStyleBox } from './styleBoxFlat';
import { flatCornerDetail } from '../../../godot/scene/defaultTheme/styleBoxes';
import { POPUP_MENU_DEFAULTS } from '../../../godot/scene/popupMenu';
import {
  DEFAULT_CORNER_RADIUS,
  LINE_EDIT_BORDER_BOTTOM_WIDTH,
  scaledGodotTheme,
  scaledPx,
  STYLE_FILL,
  type ScaledGodotTheme,
} from '../../../godot/scene/theme';
import type { StyleBoxFlatData } from './styleBoxFlat';
import type { Rgba } from '../../../godot/math/math';
import { defaultThemeAt } from '../../../godot/scene/defaultTheme/defaultTheme';
import { defaultStyleBoxesOf } from './defaultThemeRecords';
import { requiredThemeItem } from './themeItems';

/**
 * The default flat stylebox's fill by draw state, from `scene/theme/default_theme.cpp`'s
 * `fill_default_theme`, which scales every length it passes to `make_flat_stylebox` but never a
 * `Color` literal, so the colours are not scaled.
 */
interface NativeThemeStyleFill {
  /** `style_normal_color` = `Color(0.1, 0.1, 0.1, 0.6)`. */
  normal: Rgba;
  /** `style_hover_color` = `Color(0.225, 0.225, 0.225, 0.6)`. */
  hover: Rgba;
  /** `style_pressed_color` = `Color(0, 0, 0, 0.6)`. */
  pressed: Rgba;
  /** `style_disabled_color` = `Color(0.1, 0.1, 0.1, 0.3)`. */
  disabled: Rgba;
  /** `style_popup_color` = `Color(0.25, 0.25, 0.25, 1)`. */
  popup: Rgba;
  /** `style_popup_hover_color` = `Color(0.4, 0.4, 0.4, 1)`. */
  popupHover: Rgba;
  /** `style_progress_color` = `Color(1, 1, 1, 0.4)`, ProgressBar's `fill`. */
  progress: Rgba;
}

/**
 * `make_flat_stylebox` (`default_theme.cpp:57-70`) for the fields
 * `StyleBoxFlatData` models. Every input is already scaled and rounded, so this
 * never scales. The fields `make_flat_stylebox` leaves alone keep `StyleBoxFlat`'s
 * defaults, and no widget here overrides `draw_center` (only a focus style does).
 */
function flatStyleBox(
  bgColor: Rgba,
  contentMargin: { left: number; top: number; right: number; bottom: number },
  cornerRadius: number,
  cornerDetail: number
): StyleBoxFlatData {
  return freezeStyleBox(makeFlatStyleBox(bgColor, { contentMargin, cornerRadius, cornerDetail }));
}

/**
 * LineEdit's `normal`/`read_only` styleboxes (`default_theme.cpp:405-417`):
 * `make_flat_stylebox(fill)` plus a bottom border set directly with
 * `set_border_width(SIDE_BOTTOM, 2)`. The border bypasses `make_flat_stylebox`,
 * so its width is a bare `2`, never `Math.round(2 * scale)`.
 */
function lineEditStyleBox(
  bgColor: Rgba,
  borderColor: Rgba,
  contentMargin: { left: number; top: number; right: number; bottom: number },
  cornerRadius: number,
  cornerDetail: number
): StyleBoxFlatData {
  return freezeStyleBox({
    ...flatStyleBox(bgColor, contentMargin, cornerRadius, cornerDetail),
    borderColor,
    borderWidth: { left: 0, top: 0, right: 0, bottom: LINE_EDIT_BORDER_BOTTOM_WIDTH },
  });
}

/** `style_pressed_color` (`default_theme.cpp:115`): LineEdit `normal`'s bottom-border colour (`:408`). */
const LINE_EDIT_NORMAL_BORDER_COLOR: Rgba = { r: 0, g: 0, b: 0, a: 0.6 };

/** `style_pressed_color * Color(1, 1, 1, 0.5)` (`default_theme.cpp:416`): `read_only`'s bottom-border colour. */
const LINE_EDIT_READ_ONLY_BORDER_COLOR: Rgba = { r: 0, g: 0, b: 0, a: 0.3 };

/**
 * The default-theme StyleBoxFlat structs the Controls that do not yet read the default theme table
 * compose from.
 */
interface NativeThemeWidgets {
  /** PopupMenu's `panel`: `make_flat_stylebox(style_popup_color)` with a 2 px border (`default_theme.cpp:743-745`). */
  popupMenuPanel: StyleBoxFlatData;
  /** AcceptDialog's `panel`: a flush, square box in `style_popup_color` with an 8 px margin (`default_theme.cpp:693`). */
  dialogPanel: StyleBoxFlatData;
  /** Button's boxes from the default theme table, for the Controls that still draw one by hand. */
  button: {
    normal: StyleBoxFlatData;
    hover: StyleBoxFlatData;
    pressed: StyleBoxFlatData;
    disabled: StyleBoxFlatData;
    focus: StyleBoxFlatData;
  };
  /** FlatMenuButton's `normal` and `disabled` from the default theme table, for ColorPicker. */
  flatMenuButton: {
    normal: StyleBoxFlatData;
    disabled: StyleBoxFlatData;
  };
  /** LineEdit's `normal`/`read_only` styleboxes, `default_theme.cpp:405-417`. */
  lineEdit: {
    normal: StyleBoxFlatData;
    readOnly: StyleBoxFlatData;
  };
}

export interface NativeTheme extends ScaledGodotTheme {
  styleFill: NativeThemeStyleFill;
  widgets: NativeThemeWidgets;
}

// A widget reuses `contentMargin`/`cornerRadius` where its `default_theme.cpp` call passes
// `default_margin` (4) or `default_corner_radius` (3).
/** The AcceptDialog panel margin before the theme scale, which `default_theme.cpp:693` applies twice. */
const DIALOG_PANEL_MARGIN = 8;

/**
 * Written only by `nativeTheme`, never cleared. Keyed, not one entry: two open previews of
 * projects with different scales would otherwise rebuild the theme and miss each per-theme memo.
 */
const themesByScale = new Map<number, NativeTheme>();

/** `NativeTheme` at a project's `gui/theme/default_theme_scale`, built once per scale: a walker per scene tile asks for the same one. */
export function nativeTheme(scale: number): NativeTheme {
  let theme = themesByScale.get(scale);
  if (!theme) {
    theme = buildNativeTheme(scale);
    themesByScale.set(scale, theme);
  }
  return theme;
}

function buildNativeTheme(scale: number): NativeTheme {
  const scaled = scaledGodotTheme(scale);
  const buttonMargin = {
    left: scaled.contentMargin,
    top: scaled.contentMargin,
    right: scaled.contentMargin,
    bottom: scaled.contentMargin,
  };
  const tableBoxes = defaultStyleBoxesOf(defaultThemeAt(scale));
  const buttonBoxes = requiredThemeItem(tableBoxes, 'Button');
  const flatMenuButtonBoxes = requiredThemeItem(tableBoxes, 'FlatMenuButton');
  // The call passes `Math::round(8 * scale)`, and `make_flat_stylebox` scales that margin again.
  const dialogMargin = scaledPx(scaledPx(DIALOG_PANEL_MARGIN, scale), scale);
  const dialogPanelMargin = {
    left: dialogMargin,
    top: dialogMargin,
    right: dialogMargin,
    bottom: dialogMargin,
  };
  const defaultDetail = flatCornerDetail(DEFAULT_CORNER_RADIUS, scale);

  return {
    ...scaled,
    styleFill: STYLE_FILL,
    widgets: {
      popupMenuPanel: {
        ...makeFlatStyleBox(STYLE_FILL.popup, {
          contentMargin: buttonMargin,
          cornerRadius: scaled.cornerRadius,
          cornerDetail: defaultDetail,
          borderWidth: POPUP_MENU_DEFAULTS.panelBorderWidth,
          borderColor: POPUP_MENU_DEFAULTS.panelBorderColor,
        }),
      },
      dialogPanel: makeFlatStyleBox(STYLE_FILL.popup, {
        contentMargin: dialogPanelMargin,
        cornerDetail: flatCornerDetail(0, scale),
      }),
      button: {
        normal: requiredThemeItem(buttonBoxes, 'normal'),
        hover: requiredThemeItem(buttonBoxes, 'hover'),
        pressed: requiredThemeItem(buttonBoxes, 'pressed'),
        disabled: requiredThemeItem(buttonBoxes, 'disabled'),
        focus: requiredThemeItem(buttonBoxes, 'focus'),
      },
      flatMenuButton: {
        normal: requiredThemeItem(flatMenuButtonBoxes, 'normal'),
        disabled: requiredThemeItem(flatMenuButtonBoxes, 'disabled'),
      },
      lineEdit: {
        // default_theme.cpp:405-409: make_flat_stylebox(style_normal_color) + border.
        normal: lineEditStyleBox(
          STYLE_FILL.normal,
          LINE_EDIT_NORMAL_BORDER_COLOR,
          buttonMargin,
          scaled.cornerRadius,
          defaultDetail
        ),
        // default_theme.cpp:413-417: make_flat_stylebox(style_disabled_color) + border.
        readOnly: lineEditStyleBox(
          STYLE_FILL.disabled,
          LINE_EDIT_READ_ONLY_BORDER_COLOR,
          buttonMargin,
          scaled.cornerRadius,
          defaultDetail
        ),
      },
    },
  };
}
