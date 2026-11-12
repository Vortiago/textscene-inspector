/**
 * ColorPicker's native layout. ColorPicker builds its widget
 * as internal children in its constructor (`scene/gui/color_picker.cpp:2069-2260`),
 * which no `.tscn` serialises, so this module ports the geometry they produce.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rect2 } from '../../../../godot/math/rect2';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import {
  buttonContentSize,
  layoutButtonContent,
  type ButtonContentInput,
  type ButtonLabelBox,
} from '../../../../r3f/controls/native/buttonBase';
import { HorizontalAlignment, VerticalAlignment } from '../../../../godot/math/alignment';
import { shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import { spinBoxArrowIconSize, spinBoxButtonsBlockWidth } from '../spinbox/nativeSolver';
import { scaledIconSize } from '../../../../r3f/controls/native/scaledSvgIcon';
import { COLOR_PICKER_BUTTON_ICON_SIZE } from '../../../../r3f/controls/native/themeIcons';
import { SizeFlags } from '../../../../godot/scene/control';
import { ContainerAlignment } from '../../../../godot/scene/container';
import { resortBoxContainer } from '../shared/boxContainerSolver';
import { pickerChildTheme } from './pickerChildTheme';
import { shapeRowHeight, shapeRowMinWidth } from './shapes/shapeRowLayout';
import { drawnShapeVariant } from './shapes/pickerShapes';
import { MODE_RGB } from './colorModes';
import { gridCellMinimumExtent } from '../shared/gridCellMinimum';
import { lineEditStyleMinSize, lineEditTextMinimumWidth } from '../lineedit/nativeSolver';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { sliderMinimumSize } from '../shared/sliderSolver';
import type { ColorPickerProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';

/** `MODE_BUTTON_COUNT` (`color_picker.h:184`). OKHSL has no mode button: only the dropdown reaches it. */
export const MODE_BUTTON_COUNT = 3;

/** `ColorMode::get_name()` per mode (`color_mode.h:72,94,118,148`). The first 3 label `mode_btns`. */
export const COLOR_MODE_NAMES = ['RGB', 'HSV', 'Linear', 'OKHSL'] as const;

/** Every internal Label and Button reads the plain "font" theme key, as `Label`, `Button` and `CheckBox` do. */
export const COLOR_PICKER_THEME_FONT_KEY = 'font';

/** Measures one run of text at the row's font size. The solver adapts `ctx.measureText` and the painter adapts `shapeButtonLabel`. */
export type TextWidthMeasurer = (text: string) => Vector2;

/** The row-height fraction of `sample` (`color_picker.cpp:1397`). */
export const COLOR_PICKER_SAMPLE_HEIGHT_FRACTION = 0.95;
/** The fixed width of `btn_pick`, `btn_shape` and `btn_mode` (`color_picker.cpp:122-124`), at scale 1. */
const COLOR_PICKER_BUTTON_WIDTH = 28;
/** `label_width` (`default_theme.cpp:1080`), at scale 1: the width floor of the channel-slider label column. */
const COLOR_PICKER_LABEL_WIDTH = 10;
/** The forced width of `hex_label` (`color_picker.cpp:170`), at scale 1. */
const COLOR_PICKER_HEX_LABEL_WIDTH = 38;
/**
 * The approximate width of `text_type`, at scale 1, sized like the other 28px
 * buttons. `color_picker.cpp:172` sizes it to match the "script" icon.
 */
const COLOR_PICKER_TEXT_TYPE_WIDTH = 28;

/**
 * The value column of `slider_gc`: the `SpinBox` minimum (`spin_box.cpp:82-86`), a `LineEdit` minimum
 * plus the buttons block, truncated as a `GridContainer` column (`gridCellMinimumExtent`).
 * `emWidthPx` is the unrounded advance of "W": `Font::get_char_size` does not ceil it.
 */
export function colorPickerValueColumnWidth(
  theme: Pick<NativeTheme, 'widgets' | 'scale'>,
  emWidthPx: number
): number {
  return gridCellMinimumExtent(
    colorPickerHexFieldMinWidth(theme, emWidthPx) +
      spinBoxButtonsBlockWidth(spinBoxArrowIconSize(theme.scale).x)
  );
}

/**
 * `LineEdit::get_minimum_size()` (`line_edit.cpp:2443-2477`) of a plain `LineEdit`, with no buttons
 * block. `c_text` (`color_picker.cpp:2215`) fills what `hexRowColumns` leaves, so only the
 * minimum size reads its own; the `SpinBox` value column adds its block to this.
 */
function colorPickerHexFieldMinWidth(theme: Pick<NativeTheme, 'widgets'>, emWidthPx: number): number {
  const { lineEdit } = theme.widgets;
  return lineEditStyleMinSize(lineEdit.normal, lineEdit.readOnly).x + lineEditTextMinimumWidth(emWidthPx);
}

/** The square `menu_option` and `folded_arrow` icons as a size. */
function colorPickerButtonIconVector(theme: Pick<NativeTheme, 'scale'>): Vector2 {
  const side = colorPickerButtonIconSize(theme);
  return { x: side, y: side };
}

/** The side of the square `menu_option` and `folded_arrow` icons (`default_theme.cpp:1088`), and of the other button icons at the theme scale. */
export function colorPickerButtonIconSize(theme: Pick<NativeTheme, 'scale'>): number {
  return scaledIconSize(COLOR_PICKER_BUTTON_ICON_SIZE, theme.scale);
}

/**
 * The natural size of `menu_btn`, an icon-only `FlatMenuButton` with no custom
 * minimum (`color_picker.cpp:2253-2261`): `Button::get_minimum_size_for_text_and_icon` (`button.cpp:
 * 481-523`) with the 16x16 `menu_option` icon (`default_theme.cpp:1088`) plus the margin of
 * `button_normal` (`default_theme.cpp:359-363`). `btn_mode` has this size, with its width floored to 28.
 */
function colorPickerMenuButtonSize(theme: Pick<NativeTheme, 'widgets' | 'scale'>): Vector2 {
  return iconButtonSize(theme, theme.widgets.flatMenuButton.normal);
}

/** The natural size of an icon-only Button drawing `box`: the icon plus the margins of `box` (`button.cpp:481-525`). */
function iconButtonSize(theme: Pick<NativeTheme, 'scale'>, box: StyleBoxFlatData): Vector2 {
  const icon = colorPickerButtonIconSize(theme);
  const margin = contentMarginSize(box);
  return { x: icon + margin.x, y: icon + margin.y };
}

/**
 * The width of `btn_pick`, `btn_shape` or `btn_mode`: the 28 minimum (`color_picker.cpp:122-124`)
 * floors the icon plus the margins of the `box` the button draws (`button.cpp:525`).
 */
function iconButtonWidth(theme: Pick<NativeTheme, 'scale'>, box: StyleBoxFlatData): number {
  return Math.max(Math.round(COLOR_PICKER_BUTTON_WIDTH * theme.scale), iconButtonSize(theme, box).x);
}

interface ColorPickerRows {
  /** The rect of `shape_container`, `null` at `SHAPE_NONE`. */
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
  /** The minimum widths of `mode_hbc` and `swatches_vbc`, measured once for the row heights. */
  modeMinWidth: number;
  swatchesMinWidth: number;
}

/** `edit_alpha`, `edit_intensity` and every row-visibility flag default to `true` (`color_picker.h:254,260,286-290`). */
function rowVisible(flag: boolean | undefined): boolean {
  return flag ?? true;
}

/** The row count of `slider_gc` (`color_picker.cpp:2178-2189`). */
export function colorPickerSliderRowCount(
  props: Pick<ColorPickerProperties, 'editAlpha' | 'editIntensity'>
): number {
  return 3 + (rowVisible(props.editAlpha) ? 1 : 0) + (rowVisible(props.editIntensity) ? 1 : 0);
}

/** The height of a row whose `LineEdit` draws `box` (`spin_box.cpp:82-86`). */
function lineRowHeight(box: StyleBoxFlatData, textHeightPx: number): number {
  return textHeightPx + contentMarginSize(box).y;
}

/**
 * The size of `mode_hbc`. A `null` `measure` means text contributes nothing
 * (the `ctx.measureText` contract). The height is the tallest child: `mode_btns`
 * have text over their own box margins (the pressed one has `mode_button_pressed`) and no icon.
 * `btn_mode` has the icon, and its custom minimum floors only its width (`color_picker.cpp:124`).
 */
function modeRowSize(
  theme: Pick<NativeTheme, 'separation' | 'scale' | 'widgets'>,
  measure: TextWidthMeasurer | null,
  pressedMode: number
): Vector2 {
  const btnModeWidth = iconButtonWidth(theme, theme.widgets.flatMenuButton.normal);
  const normalMarginY = contentMarginSize(theme.widgets.tabContainer.unselected).y;
  const pressedMarginY = contentMarginSize(theme.widgets.tabContainer.selected).y;
  const btnModeHeight = colorPickerMenuButtonSize(theme).y;
  let height = Math.max(normalMarginY, pressedMarginY, btnModeHeight);
  if (!measure) return { x: btnModeWidth, y: height };
  let width = btnModeWidth;
  COLOR_MODE_NAMES.slice(0, MODE_BUTTON_COUNT).forEach((name, index) => {
    const m = measure(name);
    width += modeButtonMinimumWidth(modeButtonBox(theme, index, pressedMode), m.x) + theme.separation;
    height = Math.max(height, m.y + (index === pressedMode ? pressedMarginY : normalMarginY));
  });
  return { x: width, y: height };
}

/** The width `shape_container` needs: none at `SHAPE_NONE`, whose row holds no control. */
function shapeRowMinWidthOf(
  theme: Pick<NativeTheme, 'separation' | 'scale'>,
  pickerShape: number | undefined
): number {
  const variant = drawnShapeVariant(pickerShape);
  return variant ? shapeRowMinWidth(theme, variant.layout) : 0;
}

/** `SHAPE_NONE` hides `btn_shape` (`color_picker.cpp:321`). */
function showsShapeButton(pickerShape: number | undefined): boolean {
  return drawnShapeVariant(pickerShape) !== null;
}

/** The height of `sample_hbc`: the taller of `btn_pick` and, unless `SHAPE_NONE` hides it, `btn_shape`. */
function sampleRowHeight(
  theme: Pick<NativeTheme, 'widgets' | 'scale'>,
  pickerShape: number | undefined
): number {
  const pick = iconButtonSize(theme, theme.widgets.button.normal).y;
  const shape = showsShapeButton(pickerShape) ? colorPickerMenuButtonSize(theme).y : 0;
  return Math.max(pick, shape);
}

/**
 * The natural size of `btn_preset` or `btn_recent_preset`: a `Button` with the `folded_arrow` icon and a
 * label, `Button::get_minimum_size_for_text_and_icon` (`button.cpp:481-523`) plus the `button.normal` margin.
 * The icon is the size of `menu_btn`'s icon, and the gap is `h_separation`.
 */
function colorPickerPresetButtonSize(
  theme: Pick<NativeTheme, 'separation' | 'scale' | 'widgets'>,
  text: Vector2
): Vector2 {
  const margin = contentMarginSize(theme.widgets.button.normal);
  const content = buttonContentSize({
    textSize: text,
    lineHeightPx: text.y,
    hasText: true,
    iconSize: colorPickerButtonIconVector(theme),
    iconAlignment: HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
    verticalIconAlignment: VerticalAlignment.VERTICAL_ALIGNMENT_CENTER,
    hSeparation: theme.separation,
  });
  return { x: margin.x + content.x, y: margin.y + content.y };
}

interface ButtonContentBoxes {
  /** The icon in `box`'s coordinates, or `null` for an icon-less button. */
  icon: Rect2 | null;
  /** The label's paragraph box in `box`'s coordinates (`ButtonLabel` draws in it). */
  label: ButtonLabelBox;
}

interface ButtonTextDirection {
  rtl: boolean;
  isTextRtl: boolean;
}

/** A Button's text as the layout reads it: its shaped size and the direction it infers. */
export interface ButtonText {
  size: Vector2;
  direction: ButtonTextDirection;
}

/** `Button` placement (`button.cpp:349-456`) of an optional left icon and the label inside `box`, in the parent's coordinates. */
function colorPickerButtonContent(
  box: Rect2,
  theme: Pick<NativeTheme, 'separation'>,
  text: ButtonText,
  look: {
    styleMargin: ButtonContentInput['styleMargin'];
    iconNaturalSize: Vector2 | null;
    textAlignment: number;
  }
): ButtonContentBoxes {
  const layout = layoutButtonContent({
    rectSize: { x: box.w, y: box.h },
    styleMargin: look.styleMargin,
    // Button's `h_separation` (`default_theme.cpp:171`) is another theme key, with the value of `separation`.
    hSeparation: theme.separation,
    iconMaxWidth: 0,
    textAlignment: look.textAlignment,
    iconAlignment: HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
    verticalIconAlignment: VerticalAlignment.VERTICAL_ALIGNMENT_CENTER,
    expandIcon: false,
    iconNaturalSize: look.iconNaturalSize,
    hasText: true,
    textNaturalSize: text.size,
    isTextRtl: text.direction.isTextRtl,
    isClipped: false,
    rtl: text.direction.rtl,
  });
  const label = layout.labelBox!;
  return {
    icon: layout.icon && {
      ...layout.icon.rect,
      x: box.x + layout.icon.rect.x,
      y: box.y + layout.icon.rect.y,
    },
    label: { ...label, leftPx: box.x + label.leftPx, topPx: box.y + label.topPx },
  };
}

/** The icon and label of `btn_preset` or `btn_recent_preset` in `box`. */
export function presetButtonContent(
  box: Rect2,
  theme: Pick<NativeTheme, 'separation' | 'scale' | 'widgets'>,
  text: ButtonText
): ButtonContentBoxes & { icon: Rect2 } {
  const boxes = colorPickerButtonContent(box, theme, text, {
    styleMargin: theme.widgets.button.normal.contentMargin,
    iconNaturalSize: colorPickerButtonIconVector(theme),
    textAlignment: HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
  });
  return { ...boxes, icon: boxes.icon! };
}

function centredButtonLabel(
  box: Rect2,
  theme: Pick<NativeTheme, 'separation'>,
  styleMargin: ButtonContentInput['styleMargin'],
  text: ButtonText
): ButtonLabelBox {
  return colorPickerButtonContent(box, theme, text, {
    styleMargin,
    iconNaturalSize: null,
    textAlignment: HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER,
  }).label;
}

/** The label of a `mode_btns` button (`color_picker.cpp:2162-2174`): centred, with the style's own margins. */
export function modeButtonLabel(
  box: Rect2,
  theme: Pick<NativeTheme, 'separation'>,
  styleBox: StyleBoxFlatData,
  text: ButtonText
): ButtonLabelBox {
  return centredButtonLabel(box, theme, styleBox.contentMargin, text);
}

/** The "#" label of `text_type` (`color_picker.cpp:1330`): a centred Button with the `button_normal` margins. */
export function textTypeLabel(
  box: Rect2,
  theme: Pick<NativeTheme, 'separation' | 'widgets'>,
  text: ButtonText
): ButtonLabelBox {
  return centredButtonLabel(box, theme, theme.widgets.button.normal.contentMargin, text);
}

function swatchesRowSize(
  theme: Pick<NativeTheme, 'separation' | 'scale' | 'widgets'>,
  measure: TextWidthMeasurer | null
): Vector2 {
  const menuBtn = colorPickerMenuButtonSize(theme);
  // A `null` `measure` zeroes the text sizes, and each button keeps its icon.
  const none = { x: 0, y: 0 };
  const swatches = colorPickerPresetButtonSize(theme, measure ? measure('Swatches') : none);
  const recent = colorPickerPresetButtonSize(theme, measure ? measure('Recent Colors') : none);
  const row1Height = Math.max(swatches.y, menuBtn.y);
  const row1Width = swatches.x + theme.separation + menuBtn.x;
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
  valueFieldTheme: Pick<NativeTheme, 'widgets' | 'scale'>,
  props: Pick<
    ColorPickerProperties,
    | 'pickerShape'
    | 'samplerVisible'
    | 'colorModesVisible'
    | 'slidersVisible'
    | 'hexVisible'
    | 'presetsVisible'
    | 'editAlpha'
    | 'editIntensity'
    | 'colorMode'
  >,
  measure: TextWidthMeasurer | null
): ColorPickerRows {
  const variant = drawnShapeVariant(props.pickerShape);
  const shapeHeight = variant ? shapeRowHeight(theme) : 0;

  const textHeightPx = measure ? measure('0').y : 0;
  const sampleHeight = sampleRowHeight(theme, props.pickerShape);
  const modeSize = modeRowSize(theme, measure, props.colorMode ?? MODE_RGB);
  const sliderRowCount = colorPickerSliderRowCount(props);
  const sliderRowHeight = lineRowHeight(valueFieldTheme.widgets.lineEdit.normal, textHeightPx);
  const slidersHeight = sliderRowCount * sliderRowHeight + (sliderRowCount - 1) * theme.separation;
  const hexHeight = lineRowHeight(theme.widgets.lineEdit.normal, textHeightPx);
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
  const shape: Rect2 | null = variant
    ? { x: 0, y: shapeY, w: Math.max(shapeRowMinWidthOf(theme, props.pickerShape), width), h: shapeHeight }
    : null;
  const sample: Rect2 | null = rowVisible(props.samplerVisible)
    ? { x: 0, y: place(sampleHeight), w: width, h: sampleHeight }
    : null;
  const mode: Rect2 | null = rowVisible(props.colorModesVisible)
    ? { x: 0, y: place(modeSize.y), w: width, h: modeSize.y }
    : null;
  const sliders: Rect2 | null = rowVisible(props.slidersVisible)
    ? { x: 0, y: place(slidersHeight), w: width, h: slidersHeight }
    : null;
  const hex: Rect2 | null = rowVisible(props.hexVisible)
    ? { x: 0, y: place(hexHeight), w: width, h: hexHeight }
    : null;
  const swatches: Rect2 | null = rowVisible(props.presetsVisible)
    ? { x: 0, y: place(swatchesSize.y), w: width, h: swatchesSize.y }
    : null;

  return {
    shape,
    sample,
    mode,
    sliders,
    hex,
    swatches,
    sliderRowCount: sliders ? sliderRowCount : 0,
    totalHeight: y,
    modeMinWidth: modeSize.x,
    swatchesMinWidth: swatchesSize.x,
  };
}

/**
 * The widest row minimum: a vertical `BoxContainer` takes the max of its
 * children's widths, not the sum. The sample row is not measured
 * (`comparison.md`).
 */
function contentMinWidth(
  theme: NativeTheme,
  valueFieldTheme: Pick<NativeTheme, 'widgets' | 'scale'>,
  props: ColorPickerProperties,
  rows: Pick<ColorPickerRows, 'modeMinWidth' | 'swatchesMinWidth'>,
  emWidthPx: number
): number {
  const scale = theme.scale;
  const labelWidth = Math.round(COLOR_PICKER_LABEL_WIDTH * scale);
  const sliderRowWidth =
    labelWidth + 2 * theme.separation + colorPickerValueColumnWidth(valueFieldTheme, emWidthPx);

  const hexLabelWidth = Math.round(COLOR_PICKER_HEX_LABEL_WIDTH * scale);
  const textTypeWidth = Math.round(COLOR_PICKER_TEXT_TYPE_WIDTH * scale);
  const hexRowWidth =
    hexLabelWidth + 2 * theme.separation + textTypeWidth + colorPickerHexFieldMinWidth(theme, emWidthPx);

  let width = 0;
  if (rowVisible(props.colorModesVisible)) width = Math.max(width, rows.modeMinWidth);
  if (rowVisible(props.slidersVisible)) width = Math.max(width, sliderRowWidth);
  if (rowVisible(props.hexVisible)) width = Math.max(width, hexRowWidth);
  if (rowVisible(props.presetsVisible)) width = Math.max(width, rows.swatchesMinWidth);
  return width;
}

/**
 * The em of the value column: the unceiled advance of "W" (`line_edit.cpp:2443-2477`). The painter
 * and the minimum size both call it, so the two cannot disagree on the column.
 */
export function colorPickerEmWidthPx(widthOf: (text: string) => number): number {
  return widthOf('W');
}

/**
 * ColorPicker does not override `get_minimum_size`: it is the minimum of `real_vbox`
 * plus the `content_margin` of `internal_margin` on every side (`color_picker.cpp:161-166`,
 * `default_theme.cpp:1074`), which equals `theme.contentMargin`.
 */
export const colorPickerMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as ColorPickerProperties;
  const { theme, valueFieldTheme } = pickerChildTheme(n, ctx.theme);
  // The painter shapes in this font (`Component.tsx`), so the minimum measures in it too.
  const fontMetrics = resolveNodeFontMetrics(n, COLOR_PICKER_THEME_FONT_KEY);
  const measureUnceiled: TextWidthMeasurer | null = ctx.measureText
    ? (text) => ctx.measureText!(text, theme.fontSize, 0, fontMetrics)
    : null;
  // The painter reserves the whole-pixel shaped width of a text, and the em of "W" stays unceiled.
  const measure: TextWidthMeasurer | null =
    measureUnceiled &&
    ((text) => {
      const size = measureUnceiled(text);
      return { x: shapedTextSizeWidthPx(size.x), y: size.y };
    });
  const emWidthPx = measureUnceiled ? colorPickerEmWidthPx((text) => measureUnceiled(text).x) : 0;
  const rows = colorPickerRows(0, theme, valueFieldTheme, props, measure);
  const width = Math.max(
    shapeRowMinWidthOf(theme, props.pickerShape),
    contentMinWidth(theme, valueFieldTheme, props, rows, emWidthPx)
  );

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

interface SliderGridRowColumns {
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
  const floor = Math.round(COLOR_PICKER_LABEL_WIDTH * theme.scale);
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

interface HexRowColumns {
  label: Rect2;
  textType: Rect2;
  field: Rect2;
}

/** The 3-column split of `hex_hbc` (`color_picker.cpp:2191-2222`). */
export function hexRowColumns(hex: Rect2, theme: NativeTheme, rtl = false): HexRowColumns {
  const scale = theme.scale;
  const labelWidth = Math.round(COLOR_PICKER_HEX_LABEL_WIDTH * scale);
  const textTypeWidth = Math.round(COLOR_PICKER_TEXT_TYPE_WIDTH * scale);
  const fieldX = hex.x + labelWidth + theme.separation + textTypeWidth + theme.separation;
  return {
    label: mirroredColumn({ x: hex.x, y: hex.y, w: labelWidth, h: hex.h }, hex, rtl),
    textType: mirroredColumn(
      { x: hex.x + labelWidth + theme.separation, y: hex.y, w: textTypeWidth, h: hex.h },
      hex,
      rtl
    ),
    field: mirroredColumn(
      { x: fieldX, y: hex.y, w: Math.max(0, hex.x + hex.w - fieldX), h: hex.h },
      hex,
      rtl
    ),
  };
}

interface ModeRowButtons {
  buttons: Rect2[];
  dropdown: Rect2;
}

/** A `mode_btns` button's minimum width: its text plus the margins of the box it draws (`button.cpp:525`). */
function modeButtonMinimumWidth(styleBox: StyleBoxFlatData, textWidth: number): number {
  return shapedTextSizeWidthPx(textWidth) + contentMarginSize(styleBox).x;
}

/**
 * The split of `mode_hbc` (`color_picker.cpp:2129-2154`): 3 `SIZE_EXPAND_FILL`
 * buttons of equal width, then the fixed-width `btn_mode` dropdown. `labelWidths` are the button texts.
 */
export function modeRowButtonRects(
  mode: Rect2,
  theme: NativeTheme,
  rtl: boolean,
  labelWidths: readonly number[],
  pressedMode: number
): ModeRowButtons {
  const dropdownWidth = iconButtonWidth(theme, theme.widgets.flatMenuButton.normal);
  // `mode_hbc` is an HBoxContainer: three `SIZE_EXPAND_FILL` buttons, then `btn_mode`, whole pixels each (`box_container.cpp:100-130`).
  const expandFill = (index: number) => ({
    minSize: {
      x: modeButtonMinimumWidth(modeButtonBox(theme, index, pressedMode), labelWidths[index]!),
      y: 0,
    },
    hSizeFlags: SizeFlags.FILL | SizeFlags.EXPAND,
    vSizeFlags: SizeFlags.FILL,
    stretchRatio: 1,
  });
  const fixed = {
    minSize: { x: dropdownWidth, y: 0 },
    hSizeFlags: SizeFlags.FILL,
    vSizeFlags: SizeFlags.FILL,
    stretchRatio: 1,
  };
  const rects = resortBoxContainer(
    false,
    { width: mode.w, height: mode.h },
    theme.separation,
    ContainerAlignment.ALIGNMENT_BEGIN,
    rtl,
    [...Array.from({ length: MODE_BUTTON_COUNT }, (_, i) => expandFill(i)), fixed]
  ).map((r) => ({ ...r, x: mode.x + r.x, y: mode.y + r.y }));
  return { buttons: rects.slice(0, MODE_BUTTON_COUNT), dropdown: rects[MODE_BUTTON_COUNT]! };
}

/**
 * `mode_button_normal` and `mode_button_pressed`: `BIND_THEME_ITEM_EXT` binds them to
 * `tab_unselected` and `tab_selected` of `TabContainer` (`color_picker.cpp:2060-2061`).
 * The `mode_button_hover` bind (`:2062`) is left out: a static preview never hovers.
 */
export function modeButtonBox(theme: Pick<NativeTheme, 'widgets'>, index: number, pressedMode: number) {
  const { selected, unselected } = theme.widgets.tabContainer;
  return index === pressedMode ? selected : unselected;
}

interface SampleRowColumns {
  pick: Rect2;
  sample: Rect2;
  shape: Rect2 | null;
}

/**
 * The 3-column split of `sample_hbc` (`color_picker.cpp:2081-2098`): fixed-width
 * `btn_pick`, `SIZE_EXPAND_FILL` `sample`, and fixed-width `btn_shape`, which
 * `SHAPE_NONE` hides (`:321`).
 */
export function sampleRowColumns(
  sample: Rect2,
  theme: NativeTheme,
  pickerShape: number | undefined,
  rtl = false
): SampleRowColumns {
  const btnWidth = iconButtonWidth(theme, theme.widgets.button.normal);
  const shapeWidth = iconButtonWidth(theme, theme.widgets.flatMenuButton.normal);
  const showShapeBtn = showsShapeButton(pickerShape);
  const shapeBtnSpace = showShapeBtn ? shapeWidth + theme.separation : 0;
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
    shape: showShapeBtn
      ? mirroredColumn(
          { x: sample.x + sample.w - shapeWidth, y: sample.y, w: shapeWidth, h: sample.h },
          sample,
          rtl
        )
      : null,
  };
}

interface SwatchesRowRects {
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
  // The two preset buttons share one height, so the block splits evenly around the gap unless the taller `menu_btn` stretches the first row.
  const firstRowHeight = Math.max(colorPickerMenuButtonSize(theme).y, (swatches.h - theme.separation) / 2);
  const recentRowHeight = swatches.h - theme.separation - firstRowHeight;
  // `btn_recent_preset` spans the row, so only the two columns of `palette_box` mirror.
  return {
    swatchesButton: mirroredColumn(
      {
        x: swatches.x,
        y: swatches.y,
        w: Math.max(0, swatches.w - theme.separation - menuButtonWidth),
        h: firstRowHeight,
      },
      swatches,
      rtl
    ),
    menuButton: mirroredColumn(
      { x: swatches.x + swatches.w - menuButtonWidth, y: swatches.y, w: menuButtonWidth, h: firstRowHeight },
      swatches,
      rtl
    ),
    recentColorsButton: {
      x: swatches.x,
      y: swatches.y + firstRowHeight + theme.separation,
      w: swatches.w,
      h: recentRowHeight,
    },
  };
}

// Slider chrome: `Slider::_notification(NOTIFICATION_DRAW)`.

/**
 * The rect of a channel `HSlider` in its grid cell: `SIZE_EXPAND_FILL` across and
 * `SIZE_SHRINK_CENTER` down (`create_slider`, `color_picker.cpp:
 * 452-453`), so it has its natural height, centred in the taller cell.
 */
export function colorPickerSliderBoxRect(cell: Rect2, theme: NativeTheme, grabber: Vector2): Rect2 {
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
export function colorPickerChannelGrabberRect(
  sliderBoxSize: Vector2,
  ratio: number,
  grabber: Vector2,
  grabberOffsetPx: number,
  rtl = false
): Rect2 {
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
