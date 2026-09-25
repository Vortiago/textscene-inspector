/**
 * ColorPicker's native layout and colour math. ColorPicker builds its widget
 * as internal children in its constructor (`scene/gui/color_picker.cpp:2069-2260`),
 * which no `.tscn` serialises, so this module ports the geometry they produce.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { linearChannelToSRGB, sRGBChannelToLinear } from '../../../../utils/colorSpace';
import type { ControlColor } from '../control/types';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import { spinBoxButtonsBlockWidth, SPIN_BOX_ARROW_ICON_SIZE } from '../spinbox/nativeSolver';
import { LINE_EDIT_MINIMUM_CHARACTER_WIDTH } from '../../../../r3f/controls/godotDefaultTheme';
import { tabBarStyleBoxes } from '../tabbar/nativeSolver';
import { sliderMinimumSize } from '../shared/sliderSolver';
import type { ColorPickerProperties } from './types';

/** `MODE_BUTTON_COUNT` (`color_picker.h:184`). OKHSL has no mode button: only the dropdown reaches it. */
export const MODE_BUTTON_COUNT = 3;

/** `ColorMode::get_name()` per mode (`color_mode.h:72,94,118,148`). The first 3 label `mode_btns`. */
export const COLOR_MODE_NAMES = ['RGB', 'HSV', 'Linear', 'OKHSL'] as const;

/** Every internal Label and Button reads the plain "font" theme key, as `Label`, `Button` and `CheckBox` do. */
export const COLOR_PICKER_THEME_FONT_KEY = 'font';

/** Measures one run of text at the row's font size. The solver adapts `ctx.measureText` and the painter adapts `shapeButtonLabel`. */
export type TextWidthMeasurer = (text: string) => Vec2;

/** The one `PickerShapeType` value (`color_picker.h`) this previewer draws. */
export const SHAPE_HSV_RECTANGLE = 0;

/** `sv_width`/`sv_height` (`default_theme.cpp:1077-1078`), at scale 1. */
export const COLOR_PICKER_SV_SIZE = 256;
/** `h_width` (`default_theme.cpp:1079`), at scale 1. */
export const COLOR_PICKER_HUE_WIDTH = 30;
/**
 * The icon size of `btn_pick`, `btn_shape`, `btn_mode` and `menu_btn`:
 * `color_picker_pipette.svg`, `picker_shape_rectangle.svg` and `tabs_menu_hl.svg`
 * are 16x16 (`scene/theme/icons/`).
 */
export const COLOR_PICKER_SAMPLE_ICON_SIZE = 16;
/** The row-height fraction of `sample` (`color_picker.cpp:1397`). */
export const COLOR_PICKER_SAMPLE_HEIGHT_FRACTION = 0.95;
/** The fixed width of `btn_pick`, `btn_shape` and `btn_mode` (`color_picker.cpp:122-124`), at scale 1. */
export const COLOR_PICKER_BUTTON_WIDTH = 28;
/** `label_width` (`default_theme.cpp:1080`), at scale 1: the width floor of the channel-slider label column. */
export const COLOR_PICKER_LABEL_WIDTH = 10;
/** The forced width of `hex_label` (`color_picker.cpp:170`), at scale 1. */
export const COLOR_PICKER_HEX_LABEL_WIDTH = 38;
/**
 * The approximate width of `text_type`, at scale 1, sized like the other 28px
 * buttons. `color_picker.cpp:172` sizes it to match the "script" icon.
 */
export const COLOR_PICKER_TEXT_TYPE_WIDTH = 28;
/** The height of a channel-slider gradient band (`margin` in every `slider_draw` of `color_mode.cpp`), at scale 1. */
export const COLOR_PICKER_SLIDER_BAND_HEIGHT = 16;

/**
 * The natural width of `values[i]`. `create_slider` sets no custom minimum on the
 * value `SpinBox` (`color_picker.cpp:456-
 * 458`), so the column floors to `SpinBox::get_minimum_size()` (`spin_box.cpp:82-86`):
 * `LineEdit::get_minimum_size()` (`line_edit.cpp:2443-2477`) plus the 16px-arrow buttons block.
 */
export function colorPickerValueColumnWidth(theme: Pick<NativeTheme, 'widgets'>, measure: TextWidthMeasurer | null): number {
  const styleMinX = Math.max(
    contentMarginSize(theme.widgets.lineEdit.normal).x,
    contentMarginSize(theme.widgets.lineEdit.readOnly).x
  );
  const emWidth = measure ? measure('W').x : 0;
  const fieldWidth = styleMinX + LINE_EDIT_MINIMUM_CHARACTER_WIDTH * emWidth;
  return fieldWidth + spinBoxButtonsBlockWidth(SPIN_BOX_ARROW_ICON_SIZE.x);
}

/**
 * The natural width of `c_text`, a plain `LineEdit` (`color_picker.cpp:2215`):
 * `LineEdit::get_minimum_size()` with no buttons block. Only the minimum size
 * reads it. The field fills what `hexRowColumns` leaves.
 */
export function colorPickerHexFieldMinWidth(theme: Pick<NativeTheme, 'widgets'>, measure: TextWidthMeasurer | null): number {
  const styleMinX = Math.max(
    contentMarginSize(theme.widgets.lineEdit.normal).x,
    contentMarginSize(theme.widgets.lineEdit.readOnly).x
  );
  const emWidth = measure ? measure('W').x : 0;
  return styleMinX + LINE_EDIT_MINIMUM_CHARACTER_WIDTH * emWidth;
}

/**
 * The natural size of `menu_btn`, an icon-only `FlatMenuButton` with no custom
 * minimum (`color_picker.cpp:2253-2261`): `Button::get_minimum_size_for_text_and_icon` (`button.cpp:
 * 481-523`) with the 16x16 `menu_option` icon (`default_theme.cpp:1088`) plus the margin of
 * `button_normal` (`default_theme.cpp:359-363`). `btn_mode` has this size, with its width floored to 28.
 */
export function colorPickerMenuButtonSize(theme: Pick<NativeTheme, 'widgets' | 'scale'>): Vec2 {
  const icon = Math.round(COLOR_PICKER_SAMPLE_ICON_SIZE * colorPickerScale(theme));
  const margin = contentMarginSize(theme.widgets.button.normal);
  return { x: icon + margin.x, y: icon + margin.y };
}

/** `ScaledGodotTheme.scale` (`godotDefaultTheme.ts`): the raw `gui/theme/default_theme_scale`. */
export function colorPickerScale(theme: Pick<NativeTheme, 'scale'>): number {
  return theme.scale;
}

/**
 * `Color::from_hsv` (`core/math/color.cpp:458-461`, delegating to
 * `set_hsv`, `:182-227`).
 */
export function hsvToRgb(h: number, s: number, v: number): ControlColor {
  if (s === 0) return { r: v, g: v, b: v, a: 1 };
  const hh = ((h * 6) % 6 + 6) % 6;
  const i = Math.floor(hh);
  const f = hh - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  switch (i) {
    case 0:
      return { r: v, g: t, b: p, a: 1 };
    case 1:
      return { r: q, g: v, b: p, a: 1 };
    case 2:
      return { r: p, g: v, b: t, a: 1 };
    case 3:
      return { r: p, g: q, b: v, a: 1 };
    case 4:
      return { r: t, g: p, b: v, a: 1 };
    default:
      return { r: v, g: p, b: q, a: 1 };
  }
}

/** `Color::inverted()` (`core/math/color.h`): flips rgb and keeps alpha. */
export function invertRgb(c: ControlColor): ControlColor {
  return { r: 1 - c.r, g: 1 - c.g, b: 1 - c.b, a: c.a };
}

export interface HsvColor {
  h: number;
  s: number;
  v: number;
}

/**
 * The HSV of `_set_pick_color` (`color_picker.cpp:324-345`): `_copy_color_to_normalized_and_intensity`
 * (`:593-602`) divides out an HDR `intensity` so no channel of `color_normalized`
 * exceeds 1. `_copy_normalized_to_hsv_okhsl` (`:552-565`) then reads the HSV of that
 * normalised colour with `Color::get_h/get_s/get_v` (`core/math/color.cpp:136-180`).
 */
export function extractHsv(color: ControlColor): HsvColor {
  const linear = {
    r: sRGBChannelToLinear(color.r),
    g: sRGBChannelToLinear(color.g),
    b: sRGBChannelToLinear(color.b),
  };
  const multiplier = Math.max(1, linear.r, linear.g, linear.b);
  const normalized = {
    r: linearChannelToSRGB(linear.r / multiplier),
    g: linearChannelToSRGB(linear.g / multiplier),
    b: linearChannelToSRGB(linear.b / multiplier),
  };

  const min = Math.min(normalized.r, normalized.g, normalized.b);
  const max = Math.max(normalized.r, normalized.g, normalized.b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (normalized.r === max) h = (normalized.g - normalized.b) / delta;
    else if (normalized.g === max) h = 2 + (normalized.b - normalized.r) / delta;
    else h = 4 + (normalized.r - normalized.g) / delta;
    h /= 6;
    if (h < 0) h += 1;
  }
  const s = max !== 0 ? delta / max : 0;
  const v = max;

  return { h, s, v };
}

export interface ColorPickerRows {
  /** The rect of `shape_container`, `null` at any `picker_shape` but `SHAPE_HSV_RECTANGLE`. */
  shape: Rect2 | null;
  /** The rect of `sample_hbc`, `null` when `sampler_visible` is false. */
  sample: Rect2 | null;
  /** The rect of `mode_hbc`, `null` when `color_modes_visible` is false. */
  mode: Rect2 | null;
  /** The rect of `slider_gc`, `null` when `sliders_visible` is false. */
  sliders: Rect2 | null;
  /** The rect of `hex_hbc`, `null` when `hex_visible` is false. */
  hex: Rect2 | null;
  /** The rect of `swatches_vbc`, `null` when `presets_visible` is false. */
  swatches: Rect2 | null;
  /** The channel rows `sliders` shows: 3, plus one each for `edit_alpha` and `edit_intensity`. `0` when `sliders` is `null`. */
  sliderRowCount: number;
  /** The combined minimum height of `real_vbox`, without the margin of `internal_margin`. */
  totalHeight: number;
}

/**
 * The minimum width of the shape row: `custom_minimum_size.x` of `sv_square`
 * (`ColorPickerShapeRectangle::update_theme`, `color_picker_shape.cpp:465`),
 * plus `separation`, plus the fixed `h_width` of `hue_slider`. `0` when nothing is drawn there.
 */
function shapeRowMinWidth(theme: Pick<NativeTheme, 'separation' | 'scale'>, pickerShape: number | undefined): number {
  if ((pickerShape ?? SHAPE_HSV_RECTANGLE) !== SHAPE_HSV_RECTANGLE) return 0;
  const scale = colorPickerScale(theme);
  return Math.round(COLOR_PICKER_SV_SIZE * scale) + theme.separation + Math.round(COLOR_PICKER_HUE_WIDTH * scale);
}

/** `edit_alpha`, `edit_intensity` and every row-visibility flag default to `true` (`color_picker.h:254,260,286-290`). */
function rowVisible(flag: boolean | undefined): boolean {
  return flag ?? true;
}

/** The row count of `slider_gc` (`color_picker.cpp:2178-2189`). */
export function colorPickerSliderRowCount(props: Pick<ColorPickerProperties, 'editAlpha' | 'editIntensity'>): number {
  return 3 + (rowVisible(props.editAlpha) ? 1 : 0) + (rowVisible(props.editIntensity) ? 1 : 0);
}

/** The height of one channel row, which the SpinBox's `LineEdit` sets (`spin_box.cpp:82-86`). */
function lineRowHeight(theme: Pick<NativeTheme, 'widgets'>, textHeightPx: number): number {
  return textHeightPx + contentMarginSize(theme.widgets.lineEdit.normal).y;
}

/**
 * The size of `mode_hbc`. A `null` `measure` means text contributes nothing
 * (the `ctx.measureText` contract). The height is the tallest child: `mode_btns`
 * have text over the tab margin and no icon. `btn_mode` has the icon, and its
 * custom minimum floors only its width (`color_picker.cpp:124`).
 */
function modeRowSize(theme: Pick<NativeTheme, 'separation' | 'scale' | 'widgets'>, measure: TextWidthMeasurer | null): Vec2 {
  const scale = colorPickerScale(theme);
  const btnModeWidth = Math.round(COLOR_PICKER_BUTTON_WIDTH * scale);
  const tabMarginY = contentMarginSize(tabBarStyleBoxes(scale).unselected).y;
  const btnModeHeight = colorPickerMenuButtonSize(theme).y;
  let height = Math.max(tabMarginY, btnModeHeight);
  if (!measure) return { x: btnModeWidth, y: height };
  let width = btnModeWidth;
  for (const name of COLOR_MODE_NAMES.slice(0, MODE_BUTTON_COUNT)) {
    const m = measure(name);
    width += m.x + theme.separation;
    height = Math.max(height, m.y + tabMarginY);
  }
  return { x: width, y: height };
}

function swatchesRowSize(theme: Pick<NativeTheme, 'separation' | 'scale' | 'widgets'>, measure: TextWidthMeasurer | null): Vec2 {
  const menuBtn = colorPickerMenuButtonSize(theme);
  const menuBtnWidth = menuBtn.x;
  const menuBtnHeight = menuBtn.y;
  // The `palette_box` row is as tall as `max(btn_preset text, menu_btn)`, with or
  // without `measure`. A `null` `measure` zeroes the text sizes, and the second row stays.
  const swatches = measure ? measure('Swatches') : { x: 0, y: 0 };
  const recent = measure ? measure('Recent Colors') : { x: 0, y: 0 };
  const row1Height = Math.max(swatches.y, menuBtnHeight);
  const row1Width = swatches.x + theme.separation + menuBtnWidth;
  return { x: Math.max(row1Width, recent.x), y: row1Height + theme.separation + recent.y };
}

/**
 * The rows, stacked as `real_vbox` does (`color_picker.cpp:2071-2082,2129-2287`).
 * The shape row is floored at `shapeRowMinWidth`, as `Control::_size_changed`
 * floors a child. Every other row is `SIZE_EXPAND_FILL` and takes the full `width`.
 */
export function colorPickerRows(
  width: number,
  theme: NativeTheme,
  props: Pick<
    ColorPickerProperties,
    'pickerShape' | 'samplerVisible' | 'colorModesVisible' | 'slidersVisible' | 'hexVisible' | 'presetsVisible' | 'editAlpha' | 'editIntensity'
  >,
  measure: TextWidthMeasurer | null
): ColorPickerRows {
  const scale = colorPickerScale(theme);
  const svSize = Math.round(COLOR_PICKER_SV_SIZE * scale);
  const drawShape = (props.pickerShape ?? SHAPE_HSV_RECTANGLE) === SHAPE_HSV_RECTANGLE;
  const shapeHeight = drawShape ? svSize : 0;

  const textHeightPx = measure ? measure('0').y : 0;
  const sampleHeight = Math.round(COLOR_PICKER_SAMPLE_ICON_SIZE * scale) + 2 * Math.round(4 * scale);
  const modeSize = modeRowSize(theme, measure);
  const sliderRowCount = colorPickerSliderRowCount(props);
  const sliderRowHeight = lineRowHeight(theme, textHeightPx);
  const slidersHeight = sliderRowCount * sliderRowHeight + (sliderRowCount - 1) * theme.separation;
  const hexHeight = lineRowHeight(theme, textHeightPx);
  const swatchesSize = swatchesRowSize(theme, measure);

  let y = 0;
  let placed = false;
  const place = (h: number): number => {
    if (placed) y += theme.separation;
    const rowY = y;
    y += h;
    placed = true;
    return rowY;
  };

  // `_update_controls` hides only the children of `shape_container`, so the row keeps its slot
  // and `separation` at any shape. Every other row uses `set_visible(false)`
  // (`color_picker.cpp:1906-1956`), which drops the row and its gap.
  const shapeY = place(shapeHeight);
  const shape: Rect2 | null = drawShape ? { x: 0, y: shapeY, w: Math.max(shapeRowMinWidth(theme, props.pickerShape), width), h: svSize } : null;
  const sample: Rect2 | null = rowVisible(props.samplerVisible) ? { x: 0, y: place(sampleHeight), w: width, h: sampleHeight } : null;
  const mode: Rect2 | null = rowVisible(props.colorModesVisible) ? { x: 0, y: place(modeSize.y), w: width, h: modeSize.y } : null;
  const sliders: Rect2 | null = rowVisible(props.slidersVisible) ? { x: 0, y: place(slidersHeight), w: width, h: slidersHeight } : null;
  const hex: Rect2 | null = rowVisible(props.hexVisible) ? { x: 0, y: place(hexHeight), w: width, h: hexHeight } : null;
  const swatches: Rect2 | null = rowVisible(props.presetsVisible) ? { x: 0, y: place(swatchesSize.y), w: width, h: swatchesSize.y } : null;

  return { shape, sample, mode, sliders, hex, swatches, sliderRowCount: sliders ? sliderRowCount : 0, totalHeight: y };
}

/**
 * The widest row minimum: a vertical `BoxContainer` takes the max of its
 * children's widths, not the sum. The sample row is not measured
 * (`comparison.md`).
 */
function contentMinWidth(theme: NativeTheme, props: ColorPickerProperties, measure: TextWidthMeasurer | null): number {
  const scale = colorPickerScale(theme);
  const labelWidth = Math.round(COLOR_PICKER_LABEL_WIDTH * scale);
  const sliderRowWidth = labelWidth + 2 * theme.separation + colorPickerValueColumnWidth(theme, measure);

  const hexLabelWidth = Math.round(COLOR_PICKER_HEX_LABEL_WIDTH * scale);
  const textTypeWidth = Math.round(COLOR_PICKER_TEXT_TYPE_WIDTH * scale);
  const hexRowWidth = hexLabelWidth + 2 * theme.separation + textTypeWidth + colorPickerHexFieldMinWidth(theme, measure);

  let width = 0;
  if (rowVisible(props.colorModesVisible)) width = Math.max(width, modeRowSize(theme, measure).x);
  if (rowVisible(props.slidersVisible)) width = Math.max(width, sliderRowWidth);
  if (rowVisible(props.hexVisible)) width = Math.max(width, hexRowWidth);
  if (rowVisible(props.presetsVisible)) width = Math.max(width, swatchesRowSize(theme, measure).x);
  return width;
}

/**
 * ColorPicker does not override `get_minimum_size`: it is the minimum of `real_vbox`
 * plus the `content_margin` of `internal_margin` on every side (`color_picker.cpp:161-166`,
 * `default_theme.cpp:1074`), which equals `theme.contentMargin`.
 */
export const colorPickerMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as ColorPickerProperties;
  const theme = ctx.theme;
  const measure: TextWidthMeasurer | null = ctx.measureText ? (text) => ctx.measureText!(text, theme.fontSize) : null;

  const rows = colorPickerRows(0, theme, props, measure);
  const width = Math.max(shapeRowMinWidth(theme, props.pickerShape), contentMinWidth(theme, props, measure));

  return {
    x: width + 2 * theme.contentMargin,
    y: rows.totalHeight + 2 * theme.contentMargin,
  };
};

/**
 * One column mirrored inside its row. Each container mirrors its own row:
 * `BoxContainer::_resort` walks an RTL box in reverse (`box_container.cpp:184-192`),
 * `GridContainer` walks left from the right edge (`grid_container.cpp:193-197,218-223`).
 * Both equal this reflection when the columns tile the row, as every row here does.
 */
function mirroredColumn(column: Rect2, row: Rect2, rtl: boolean): Rect2 {
  if (!rtl) return column;
  // `fit_child_in_rect` (`container.cpp:95-128`) adds no second mirror: `_compute_offsets`
  // (`control.cpp:904-915`) mirrors as much as `_size_changed` mirrors back (`:1785-1787`).
  return { ...column, x: row.x + row.w - (column.x - row.x) - column.w };
}

export interface ShapeRowSplit {
  svSquare: Rect2;
  hueSlider: Rect2;
}

/**
 * Splits the shape row into `sv_square` and `hue_slider`
 * (`ColorPickerShapeRectangle::_initialize_controls`, `color_picker_shape.cpp:436-452`):
 * `hue_slider` keeps its fixed `h_width`, and `sv_square` takes the rest
 * (`SIZE_EXPAND_FILL`, `color_picker_shape.cpp:438`), with `separation` between.
 */
export function svAndHueRects(shape: Rect2, theme: Pick<NativeTheme, 'separation' | 'scale'>, rtl = false): ShapeRowSplit {
  const scale = colorPickerScale(theme);
  const hueWidth = Math.round(COLOR_PICKER_HUE_WIDTH * scale);
  const svWidth = shape.w - theme.separation - hueWidth;
  return {
    svSquare: mirroredColumn({ x: shape.x, y: shape.y, w: svWidth, h: shape.h }, shape, rtl),
    hueSlider: mirroredColumn({ x: shape.x + svWidth + theme.separation, y: shape.y, w: hueWidth, h: shape.h }, shape, rtl),
  };
}

/**
 * `ColorPickerShape::draw_sv_square`'s cursor placement
 * (`color_picker_shape.cpp:259-261`), clamped to the square.
 */
export function svSquareCursorPosition(square: Rect2, s: number, v: number): Vec2 {
  const end = { x: square.x + square.w, y: square.y + square.h };
  return {
    x: Math.min(Math.max(square.x + square.w * s, square.x), end.x),
    y: Math.min(Math.max(square.y + square.h * (1 - v), square.y), end.y),
  };
}

/** `ColorPickerShapeRectangle::_hue_slider_draw`'s indicator line (`color_picker_shape.cpp:431`). */
export function hueIndicatorY(height: number, h: number): number {
  return height * h;
}

export interface SliderGridRowColumns {
  label: Rect2;
  slider: Rect2;
  value: Rect2;
}

/**
 * The label column width of `slider_gc`: the widest label, floored at
 * `theme_cache.label_width` (`color_picker.cpp:145,148,150`). `GridContainer`
 * sizes a column to its widest cell, so a letter wider than 10px widens it.
 */
export function colorPickerLabelColumnWidth(
  theme: Pick<NativeTheme, 'scale'>,
  measure: TextWidthMeasurer | null,
  labels: readonly string[]
): number {
  const floor = Math.round(COLOR_PICKER_LABEL_WIDTH * colorPickerScale(theme));
  if (!measure) return floor;
  let width = floor;
  for (const label of labels) width = Math.max(width, measure(label).x);
  return width;
}

/**
 * The 3-column split of `slider_gc` (`color_picker.cpp:2172-2180`) for each visible
 * row, top to bottom in the enum order of `color_picker.h:156-159`. The caller
 * supplies `labelWidth` and `valueWidth`.
 */
export function sliderGridRowRects(
  sliders: Rect2,
  rowCount: number,
  theme: NativeTheme,
  labelWidth: number,
  valueWidth: number,
  rtl = false
): SliderGridRowColumns[] {
  const sliderWidth = Math.max(0, sliders.w - labelWidth - valueWidth - 2 * theme.separation);
  const rowHeight = rowCount > 0 ? (sliders.h - (rowCount - 1) * theme.separation) / rowCount : 0;

  const rows: SliderGridRowColumns[] = [];
  for (let i = 0; i < rowCount; i++) {
    const y = sliders.y + i * (rowHeight + theme.separation);
    const labelX = sliders.x;
    const sliderX = labelX + labelWidth + theme.separation;
    const valueX = sliderX + sliderWidth + theme.separation;
    rows.push({
      label: mirroredColumn({ x: labelX, y, w: labelWidth, h: rowHeight }, sliders, rtl),
      slider: mirroredColumn({ x: sliderX, y, w: sliderWidth, h: rowHeight }, sliders, rtl),
      value: mirroredColumn({ x: valueX, y, w: valueWidth, h: rowHeight }, sliders, rtl),
    });
  }
  return rows;
}

export interface HexRowColumns {
  label: Rect2;
  textType: Rect2;
  field: Rect2;
}

/** The 3-column split of `hex_hbc` (`color_picker.cpp:2191-2222`). */
export function hexRowColumns(hex: Rect2, theme: NativeTheme, rtl = false): HexRowColumns {
  const scale = colorPickerScale(theme);
  const labelWidth = Math.round(COLOR_PICKER_HEX_LABEL_WIDTH * scale);
  const textTypeWidth = Math.round(COLOR_PICKER_TEXT_TYPE_WIDTH * scale);
  const fieldX = hex.x + labelWidth + theme.separation + textTypeWidth + theme.separation;
  return {
    label: mirroredColumn({ x: hex.x, y: hex.y, w: labelWidth, h: hex.h }, hex, rtl),
    textType: mirroredColumn({ x: hex.x + labelWidth + theme.separation, y: hex.y, w: textTypeWidth, h: hex.h }, hex, rtl),
    field: mirroredColumn({ x: fieldX, y: hex.y, w: Math.max(0, hex.x + hex.w - fieldX), h: hex.h }, hex, rtl),
  };
}

export interface ModeRowButtons {
  buttons: Rect2[];
  dropdown: Rect2;
}

/**
 * The split of `mode_hbc` (`color_picker.cpp:2129-2154`): 3 `SIZE_EXPAND_FILL`
 * buttons of equal width, then the fixed-width `btn_mode` dropdown.
 */
export function modeRowButtonRects(mode: Rect2, theme: NativeTheme, rtl = false): ModeRowButtons {
  const scale = colorPickerScale(theme);
  const dropdownWidth = Math.round(COLOR_PICKER_BUTTON_WIDTH * scale);
  const buttonsWidth = Math.max(0, mode.w - dropdownWidth - theme.separation - (MODE_BUTTON_COUNT - 1) * theme.separation);
  const buttonWidth = buttonsWidth / MODE_BUTTON_COUNT;

  const buttons: Rect2[] = [];
  for (let i = 0; i < MODE_BUTTON_COUNT; i++) {
    buttons.push(mirroredColumn({ x: mode.x + i * (buttonWidth + theme.separation), y: mode.y, w: buttonWidth, h: mode.h }, mode, rtl));
  }
  const dropdownX = mode.x + buttonsWidth + MODE_BUTTON_COUNT * theme.separation;
  return { buttons, dropdown: mirroredColumn({ x: dropdownX, y: mode.y, w: dropdownWidth, h: mode.h }, mode, rtl) };
}

/**
 * `mode_button_normal` and `mode_button_pressed`: `BIND_THEME_ITEM_EXT` binds them to
 * `tab_unselected` and `tab_selected` of `TabContainer` (`color_picker.cpp:2060-2061`).
 * The `mode_button_hover` bind (`:2062`) is left out: a static preview never hovers.
 */
export function colorPickerModeButtonStyleBox(theme: Pick<NativeTheme, 'scale'>, pressed: boolean) {
  const boxes = tabBarStyleBoxes(colorPickerScale(theme));
  return pressed ? boxes.selected : boxes.unselected;
}

export interface SampleRowColumns {
  pick: Rect2;
  sample: Rect2;
  shape: Rect2 | null;
}

/**
 * The 3-column split of `sample_hbc` (`color_picker.cpp:2081-2098`): fixed-width
 * `btn_pick`, `SIZE_EXPAND_FILL` `sample`, and fixed-width `btn_shape`, which
 * `SHAPE_NONE` hides (`:321`).
 */
export function sampleRowColumns(sample: Rect2, theme: NativeTheme, pickerShape: number | undefined, rtl = false): SampleRowColumns {
  const scale = colorPickerScale(theme);
  const btnWidth = Math.round(COLOR_PICKER_BUTTON_WIDTH * scale);
  const showShapeBtn = (pickerShape ?? SHAPE_HSV_RECTANGLE) !== 4; // SHAPE_NONE
  const shapeBtnSpace = showShapeBtn ? btnWidth + theme.separation : 0;
  return {
    pick: mirroredColumn({ x: sample.x, y: sample.y, w: btnWidth, h: sample.h }, sample, rtl),
    sample: mirroredColumn(
      {
        x: sample.x + btnWidth + theme.separation,
        y: sample.y,
        w: Math.max(0, sample.w - btnWidth - theme.separation - shapeBtnSpace),
        h: sample.h,
      },
      sample,
      rtl
    ),
    shape: showShapeBtn ? mirroredColumn({ x: sample.x + sample.w - btnWidth, y: sample.y, w: btnWidth, h: sample.h }, sample, rtl) : null,
  };
}

export interface SwatchesRowRects {
  swatchesButton: Rect2;
  menuButton: Rect2;
  recentColorsButton: Rect2;
}

/**
 * The two rows of `swatches_vbc` (`color_picker.cpp:2239-2287`): `palette_box`
 * ("Swatches" and `menu_btn`), then "Recent Colors". The preset grids stay
 * collapsed: presets arrive only through `add_preset()` at runtime.
 */
export function swatchesRowRects(swatches: Rect2, theme: NativeTheme, rtl = false): SwatchesRowRects {
  const menuButtonWidth = colorPickerMenuButtonSize(theme).x;
  // Both rows have the text height, so the block splits evenly around the gap.
  const rowHeight = (swatches.h - theme.separation) / 2;
  // `btn_recent_preset` spans the row, so only the two columns of `palette_box` mirror.
  return {
    swatchesButton: mirroredColumn(
      { x: swatches.x, y: swatches.y, w: Math.max(0, swatches.w - theme.separation - menuButtonWidth), h: rowHeight },
      swatches,
      rtl
    ),
    menuButton: mirroredColumn({ x: swatches.x + swatches.w - menuButtonWidth, y: swatches.y, w: menuButtonWidth, h: rowHeight }, swatches, rtl),
    recentColorsButton: { x: swatches.x, y: swatches.y + rowHeight + theme.separation, w: swatches.w, h: rowHeight },
  };
}

// Slider chrome: `Slider::_notification(NOTIFICATION_DRAW)`.

/**
 * The rect of a channel `HSlider` in its grid cell: `SIZE_EXPAND_FILL` across and
 * `SIZE_SHRINK_CENTER` down (`create_slider`, `color_picker.cpp:
 * 452-453`), so it has its natural height, centred in the taller cell.
 */
export function colorPickerSliderBoxRect(cell: Rect2, theme: NativeTheme, grabber: Vec2): Rect2 {
  const h = sliderMinimumSize(false, theme, grabber).y;
  // `Control::fit_child_in_rect` (`control.h`, `SIZE_SHRINK_CENTER`) floors:
  // `r.position.y += Math::floor((p_rect.size.y - minsize.y) / 2)`.
  const y = cell.y + Math.floor((cell.h - h) / 2);
  return { x: cell.x, y, w: cell.w, h };
}

/**
 * `_reset_sliders_theme` (`color_picker.cpp:628-651`) gives `sliders[0..2]` and
 * `alpha_slider` the `bar_arrow` grabber, `grabber_offset = 8 * base_scale` and
 * `center_grabber = true`. `intensity_slider` keeps the Slider defaults.
 */
export const COLOR_PICKER_SLIDER_GRABBER_OFFSET = 8;

/**
 * The rect of the overridden grabber with `center_grabber = true` (`slider.cpp:322-334,363`):
 * `areasize` is the full width, and `grabber_shift = -grabber->get_width() / 2`
 * centres the icon on the ratio point. `Point2i` truncates each whole expression
 * once, and `grabber_offset` is a separate int addition.
 */
export function colorPickerChannelGrabberRect(sliderBoxSize: Vec2, ratio: number, grabber: Vec2, grabberOffsetPx: number, rtl = false): Rect2 {
  const size = { x: Math.trunc(sliderBoxSize.x), y: Math.trunc(sliderBoxSize.y) };
  const areasize = size.x;
  const grabberShift = -Math.trunc(grabber.x / 2);
  const x = Math.trunc((rtl ? 1 - ratio : ratio) * areasize + grabberShift);
  const y = Math.trunc(size.y / 2) - Math.trunc(grabber.y / 2) + grabberOffsetPx;
  return { x, y, w: grabber.x, h: grabber.y };
}

/**
 * The ratio in the fixed range of `intensity_slider`, -10 to 10 (`color_picker.cpp:2183-2185`).
 * The value is derived, so it has no `RangeProperties` for `resolveSliderRatio`.
 */
export function colorPickerIntensityRatio(value: number): number {
  return (value - -10) / 20;
}
