/**
 * ColorPicker's native (WebGL canvas) layout + colour math. ColorPicker
 * builds its whole widget as INTERNAL children in its C++ constructor
 * (`scene/gui/color_picker.cpp:2069-2260`), none of which a `.tscn` ever
 * serialises, so this module ports the geometry those constants and formulas
 * would have produced rather than a `_notification(NOTIFICATION_SORT_CHILDREN)`
 * this codebase's solve tree never sees.
 *
 * Pure data + functions, no React, no THREE — matches every other `native/`
 * solver module's convention (painting is `Component.tsx`'s job).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { sRGBChannelToLinear } from '../../../../utils/colorSpace';
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

/** `MODE_BUTTON_COUNT` (`color_picker.h:184`) — OKHSL has no mode button; only the dropdown reaches it. */
export const MODE_BUTTON_COUNT = 3;

/** `ColorMode::get_name()` per mode (`color_mode.h:72,94,118,148`) — `mode_btns[i]`'s own label text for the first 3. */
export const COLOR_MODE_NAMES = ['RGB', 'HSV', 'Linear', 'OKHSL'] as const;

/** Every internal Label/Button this painter draws reads Godot's plain "font" theme key — the SAME generic key `Label`/`Button`/`CheckBox` themselves use (`LABEL_THEME_FONT_KEY`/`BUTTON_THEME_FONT_KEY`'s own doc). */
export const COLOR_PICKER_THEME_FONT_KEY = 'font';

/** Measures one run of text at this row's own font size — the caller's `ctx.measureText`/`shapeButtonLabel` adapted to this shape (`Component.tsx`'s own doc for why the two callers cannot share one measurement call). */
export type TextWidthMeasurer = (text: string) => Vec2;

/** `set_picker_shape`'s own enum (`color_picker.h`'s `PickerShapeType`) — only the one value this previewer draws. */
export const SHAPE_HSV_RECTANGLE = 0;

/** `sv_width`/`sv_height` (`default_theme.cpp:1077-1078`), at scale 1. */
export const COLOR_PICKER_SV_SIZE = 256;
/** `h_width` (`default_theme.cpp:1079`), at scale 1. */
export const COLOR_PICKER_HUE_WIDTH = 30;
/**
 * `btn_pick`/`btn_shape`/`btn_mode`/`menu_btn`'s own icon size —
 * `color_picker_pipette.svg`/`picker_shape_rectangle.svg`/`tabs_menu_hl.svg`
 * are all 16x16 (`scene/theme/icons/`). `themeIcons.ts` (out of this
 * packet's files) vendors none of these, so every such button draws its
 * box/text but not its icon — this sizes the space the icon would occupy.
 */
export const COLOR_PICKER_SAMPLE_ICON_SIZE = 16;
/** `sample`'s own row-height fraction (`color_picker.cpp:1397`). */
export const COLOR_PICKER_SAMPLE_HEIGHT_FRACTION = 0.95;
/** `btn_pick`/`btn_shape`/`btn_mode`'s own fixed width (`color_picker.cpp:122-124`), at scale 1. */
export const COLOR_PICKER_BUTTON_WIDTH = 28;
/** `label_width` (`default_theme.cpp:1080`), at scale 1 — the channel-slider label column's forced width. */
export const COLOR_PICKER_LABEL_WIDTH = 10;
/** `hex_label`'s own forced width (`color_picker.cpp:170`), at scale 1. */
export const COLOR_PICKER_HEX_LABEL_WIDTH = 38;
/**
 * `text_type`'s own approximate width, at scale 1 — sized like the other
 * 28px buttons (`color_picker.cpp:172` sizes it to match the "script" icon,
 * not vendored here either — see `COLOR_PICKER_SAMPLE_ICON_SIZE`'s own doc).
 */
export const COLOR_PICKER_TEXT_TYPE_WIDTH = 28;
/** The channel-slider gradient band's own height (`color_mode.cpp`'s `margin`, every `slider_draw` override), at scale 1 — shared with the hue/alpha strips. */
export const COLOR_PICKER_SLIDER_BAND_HEIGHT = 16;

/**
 * `values[i]`'s own natural width — `create_slider` never calls
 * `set_custom_minimum_size` on the value `SpinBox` (`color_picker.cpp:456-
 * 458`), unlike every fixed-width button/label beside it, so the column
 * floors to `SpinBox::get_minimum_size()` (`spin_box.cpp:82-86`):
 * `line_edit->get_combined_minimum_size()` — `LineEdit::get_minimum_size()`
 * (`line_edit.cpp:2443-2477`), no per-node override reaching the internal
 * field (`spinbox/nativeSolver.ts`'s own doc for why) — plus the buttons
 * block, reused from `spinbox/nativeSolver.ts` rather than re-derived. The
 * vendored 16px arrow icons are always the widest: `values[i]` never carries
 * a `theme_override_icons/up`/`down` of its own.
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
 * `c_text`'s own natural width — a plain `LineEdit`, never a `SpinBox`
 * (`color_picker.cpp:2215`), so it is `LineEdit::get_minimum_size()` alone,
 * with no buttons block added. Only `contentMinWidth` below reads this: the
 * field itself always renders at whatever width `hexRowColumns` leaves it
 * (`SIZE_EXPAND_FILL`), never this floor.
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
 * `menu_btn`'s own natural size — an icon-only `MenuButton` under
 * `"FlatMenuButton"` with no `custom_minimum_size` of its own
 * (`color_picker.cpp:2253-2261`, contrast `btn_pick`/`btn_shape`/`btn_mode`'s
 * fixed 28px): `Button::get_minimum_size_for_text_and_icon` (`button.cpp:
 * 481-523`) with empty text and `menu_option`'s 16×16 icon
 * (`default_theme.cpp:1088`), plus `flat_button_normal`'s content margin —
 * `button_normal`'s own margin (`default_theme.cpp:359-363`), exactly
 * `theme.widgets.button.normal`'s margin already (`nativeTheme.ts`'s
 * `buttonMargin`, the same unbordered `make_flat_stylebox` call), reused
 * rather than re-derived. `btn_mode` shares this same natural size (only its
 * WIDTH is then floored up to 28 by its own `custom_minimum_size`).
 */
export function colorPickerMenuButtonSize(theme: Pick<NativeTheme, 'widgets' | 'scale'>): Vec2 {
  const icon = Math.round(COLOR_PICKER_SAMPLE_ICON_SIZE * colorPickerScale(theme));
  const margin = contentMarginSize(theme.widgets.button.normal);
  return { x: icon + margin.x, y: icon + margin.y };
}

/** `ScaledGodotTheme.scale` (`godotDefaultTheme.ts`) — the raw `gui/theme/default_theme_scale`, exposed directly. */
export function colorPickerScale(theme: Pick<NativeTheme, 'scale'>): number {
  return theme.scale;
}

/**
 * `Color::linear_to_srgb` (`core/math/color.h:199-204`) — the inverse of
 * `sRGBChannelToLinear` (`utils/colorSpace.ts`), needed for
 * `_copy_color_to_normalized_and_intensity`'s HDR normalisation below. Not
 * added to that shared module: it lives outside this packet's slices.
 */
function linearChannelToSRGB(c: number): number {
  if (c < 0.0031308) return 12.92 * c;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/**
 * `Color::from_hsv` (`core/math/color.cpp:458-461`, delegating to
 * `set_hsv`, `:182-227`) — full saturation/value stops for the SV square's
 * gradient and the hue slider's indicator line both need this.
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

/** `Color::inverted()` (`core/math/color.h`) — flips rgb, leaves alpha. */
export function invertRgb(c: ControlColor): ControlColor {
  return { r: 1 - c.r, g: 1 - c.g, b: 1 - c.b, a: c.a };
}

export interface HsvColor {
  h: number;
  s: number;
  v: number;
}

/**
 * `ColorPicker::_set_pick_color`'s HSV derivation
 * (`color_picker.cpp:324-345`): `_copy_color_to_normalized_and_intensity`
 * (`:593-602`) extracts an HDR `intensity` so `color_normalized`'s own
 * channels never exceed 1, then `_copy_normalized_to_hsv_okhsl` (`:552-565`)
 * reads `get_h`/`get_s`/`get_v` off THAT normalised colour, not the raw one.
 * For every non-overbright colour `multiplier` is exactly 1 and this is
 * `Color::get_h/get_s/get_v` (`core/math/color.cpp:136-180`) on `color`
 * unchanged.
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
  /** `shape_container`'s own rect, `null` when nothing is drawn there (any `picker_shape` but `SHAPE_HSV_RECTANGLE`). */
  shape: Rect2 | null;
  /** `sample_hbc`'s own rect, `null` when `sampler_visible` is false. */
  sample: Rect2 | null;
  /** `mode_hbc`'s own rect, `null` when `color_modes_visible` is false. */
  mode: Rect2 | null;
  /** `slider_gc`'s own rect, `null` when `sliders_visible` is false. */
  sliders: Rect2 | null;
  /** `hex_hbc`'s own rect, `null` when `hex_visible` is false. */
  hex: Rect2 | null;
  /** `swatches_vbc`'s own rect (its `palette_box`/`btn_recent_preset` rows), `null` when `presets_visible` is false. */
  swatches: Rect2 | null;
  /** The number of channel rows `sliders` actually shows — 3 plus `edit_alpha`/`edit_intensity`. `0` when `sliders` is `null`. */
  sliderRowCount: number;
  /** The combined height every visible row above sums to (`real_vbox`'s own combined minimum height, EXCLUDING `internal_margin`'s own margin). */
  totalHeight: number;
}

/**
 * The shape row's OWN minimum width — `sv_square`'s `custom_minimum_size.x`
 * (`ColorPickerShapeRectangle::update_theme`, `color_picker_shape.cpp:465`)
 * plus the row's `separation` plus `hue_slider`'s fixed `h_width`. `0` when
 * nothing is drawn there.
 */
function shapeRowMinWidth(theme: Pick<NativeTheme, 'separation' | 'scale'>, pickerShape: number | undefined): number {
  if ((pickerShape ?? SHAPE_HSV_RECTANGLE) !== SHAPE_HSV_RECTANGLE) return 0;
  const scale = colorPickerScale(theme);
  return Math.round(COLOR_PICKER_SV_SIZE * scale) + theme.separation + Math.round(COLOR_PICKER_HUE_WIDTH * scale);
}

/** `edit_alpha`/`edit_intensity`/every row-visibility flag default `true` (`color_picker.h:254,260,286-290`) — an absent `.tscn` key means the row shows. */
function rowVisible(flag: boolean | undefined): boolean {
  return flag ?? true;
}

/** `slider_gc`'s own row count for the current mode + `edit_alpha`/`edit_intensity` (`color_picker.cpp:2178-2189`, `_update_controls`'s show/hide loop). */
export function colorPickerSliderRowCount(props: Pick<ColorPickerProperties, 'editAlpha' | 'editIntensity'>): number {
  return 3 + (rowVisible(props.editAlpha) ? 1 : 0) + (rowVisible(props.editIntensity) ? 1 : 0);
}

/** One channel row's own height — the SpinBox's `LineEdit` dominates (`spin_box.cpp:82-86`), its content margin the same box every `LineEdit`/`SpinBox` in this theme uses. */
function lineRowHeight(theme: Pick<NativeTheme, 'widgets'>, textHeightPx: number): number {
  return textHeightPx + contentMarginSize(theme.widgets.lineEdit.normal).y;
}

/**
 * The two rows `measure === null` cannot size at all: `mode_hbc` (3 button
 * labels + the dropdown) and `swatches_vbc` ("Swatches"/"Recent Colors").
 * `measure` follows `solverRegistry.ts`'s own `ctx.measureText` contract —
 * an absent measurer means "text contributes nothing", never a thrown error.
 *
 * Row height is `max` of every child's own natural height, never the old
 * icon-only floor: `mode_btns[0..2]` carry NO icon (`iconHeight` never
 * applied to them), only text over `tab_unselected`/`tab_selected`'s own
 * content margin (`colorPickerModeButtonStyleBox`'s own doc for the stylebox
 * itself); `btn_mode` is the one child with an icon, sized by
 * `colorPickerMenuButtonSize` (its own `custom_minimum_size` floors WIDTH
 * only, `color_picker.cpp:124`, never height).
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
  // `palette_box`'s own row height is `max(btn_preset text, menu_btn icon)` —
  // `menu_btn` sits in that row regardless of whether `measure` can size the
  // "Swatches" text beside it, so the icon floor applies either way. An
  // absent `measure` still means "text contributes nothing" for both rows'
  // WIDTH and for `btn_recent_preset`'s own height (`solverRegistry.ts`'s
  // contract), never that the second row disappears.
  const swatches = measure ? measure('Swatches') : { x: 0, y: 0 };
  const recent = measure ? measure('Recent Colors') : { x: 0, y: 0 };
  const row1Height = Math.max(swatches.y, menuBtnHeight);
  const row1Width = swatches.x + theme.separation + menuBtnWidth;
  return { x: Math.max(row1Width, recent.x), y: row1Height + theme.separation + recent.y };
}

/**
 * The rows this painter draws, stacked exactly as `real_vbox`
 * (`color_picker.cpp:2071-2082,2129-2287`) would — `sv_square` fills
 * whatever is left after `hue_slider` and the row's `separation`, floored at
 * its own minimum (`shapeRowMinWidth`) exactly as `Control::_size_changed`
 * floors every child against its `fit_child_in_rect` rect; every other row
 * simply takes the FULL solved `width` (every one of them is
 * `SIZE_EXPAND_FILL` inside `real_vbox`, VBoxContainer's own default).
 *
 * `shape_container` stays a participating VBox row (and so keeps its
 * `separation` gap) even at `picker_shape !== SHAPE_HSV_RECTANGLE`: only its
 * CHILDREN hide per-shape (`ColorPicker::_update_controls`), never the row
 * itself. Every OTHER row uses plain `set_visible(false)`
 * (`color_picker.cpp:1906-1956`), which drops the row AND its `separation`
 * gap from the stack entirely — `stackVisible` below reproduces that
 * distinction: `shape` always occupies a stacking slot, every other row only
 * while its own flag is true.
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

  // `shape_container` always occupies a stacking slot, drawn or not (this
  // function's own doc) — `place` still runs (and still charges the
  // trailing separation to whatever comes next) even at `shapeHeight === 0`.
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
 * The widest natural minimum any row needs — `real_vbox`'s own combined
 * minimum WIDTH is the max of its children's, never a sum (`BoxContainer::
 * get_minimum_size`, horizontal axis of a VERTICAL box). Only rows that
 * genuinely contribute their own natural width are measured; `sample`'s own
 * (the pick/shape buttons plus the flexible sample rect) contributes nothing
 * narrower than the shape row ever produces, so it is not modelled here —
 * documented on the comparison sheet.
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
 * `ColorPicker::get_minimum_size` is not overridden — Godot floors it from
 * `real_vbox`'s own combined minimum, wrapped in `internal_margin`'s own
 * `content_margin` on every side (`color_picker.cpp:161-166`,
 * `default_theme.cpp:1074`, `Math.round(4 * scale)` — `theme.contentMargin`
 * already is that number).
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
 * One column mirrored inside the row it was laid out in. `color_picker.cpp`
 * never calls `is_layout_rtl()`: ColorPicker builds its whole widget tree from
 * ordinary containers in its constructor, and each one mirrors its own row.
 * `BoxContainer::_resort` walks an RTL horizontal box's children in REVERSE
 * and places them left to right (`box_container.cpp:184-192`), and
 * `GridContainer` starts `col_ofs` at the grid's right edge and walks left
 * (`grid_container.cpp:193-197,218-223`). Both come out as this reflection
 * wherever the columns tile their row exactly, which every row below does.
 *
 * `Container::fit_child_in_rect` (`container.cpp:95-128`) is not a second
 * mirror: `Control::set_rect` pre-mirrors through `_compute_offsets`
 * (`control.cpp:904-915`) exactly as much as `_size_changed` mirrors back
 * (`:1785-1787`), so a child lands where its container put it either way.
 */
function mirroredColumn(column: Rect2, row: Rect2, rtl: boolean): Rect2 {
  if (!rtl) return column;
  return { ...column, x: row.x + row.w - (column.x - row.x) - column.w };
}

export interface ShapeRowSplit {
  svSquare: Rect2;
  hueSlider: Rect2;
}

/**
 * Splits `colorPickerRows`'s own `shape` rect into `sv_square` and
 * `hue_slider` (`ColorPickerShapeRectangle::_initialize_controls`,
 * `color_picker_shape.cpp:436-452`): `hue_slider` keeps its fixed `h_width`,
 * `sv_square` takes everything else (`SIZE_EXPAND_FILL`,
 * `color_picker_shape.cpp:438`), separated by the row's own `separation`.
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
 * (`color_picker_shape.cpp:259-261`), clamped to the square's own bounds.
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
 * `labels[i]`/`alpha_label`/`intensity_label`'s own combined-minimum WIDTH:
 * `theme_cache.label_width`'s floor (`color_picker.cpp:145,148,150`) against
 * each row's own shaped single-letter text, the WIDEST of which sets
 * `slider_gc`'s shared column (`GridContainer` sizes a column to its widest
 * cell — `label_width` alone is never enough once a font renders a letter
 * wider than 10px).
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
 * `slider_gc`'s own 3-column split (`color_picker.cpp:2172-2180`,
 * `create_slider`) for every visible row, TOP to BOTTOM in `create_slider`'s
 * own call order: `MODE_SLIDER_COUNT` (3) channel rows, then intensity
 * (`SLIDER_INTENSITY`), then alpha (`SLIDER_ALPHA`) — `_update_controls`
 * hides whichever of the last two `edit_intensity`/`edit_alpha` turns off,
 * WITHOUT re-ordering the rest (`color_picker.h:156-159`'s own enum order).
 * `labelWidth`/`valueWidth` are the caller's own (`colorPickerLabelColumnWidth`/
 * `colorPickerValueColumnWidth`) — this function only splits columns, it
 * derives neither.
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

/** `hex_hbc`'s own 3-column split (`color_picker.cpp:2191-2222`). */
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
 * `mode_hbc`'s own split (`color_picker.cpp:2129-2154`): `MODE_BUTTON_COUNT`
 * (3) `SIZE_EXPAND_FILL` buttons sharing the row's own width EQUALLY (no
 * other size flag distinguishes them), then the fixed-width `btn_mode`
 * dropdown.
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
 * `mode_button_normal`/`mode_button_pressed` — `BIND_THEME_ITEM_EXT` binds
 * both straight to `TabContainer`'s own `tab_unselected`/`tab_selected`
 * (`color_picker.cpp:2060-2061`), the SAME construction
 * `tabbar/nativeSolver.ts`'s `tabBarStyleBoxes` already reproduces, reused
 * here rather than re-derived. `mode_button_hover`'s bind to `tab_selected`
 * too (`:2062`) is not modelled: a static previewer never hovers.
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
 * `sample_hbc`'s own 3-column split (`color_picker.cpp:2081-2098`):
 * `btn_pick` (fixed width), `sample` (`SIZE_EXPAND_FILL`), `btn_shape`
 * (fixed width, hidden at `SHAPE_NONE` — `btn_shape->set_visible(current_shape
 * != SHAPE_NONE)`, `:321`).
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
 * `swatches_vbc`'s own two rows (`color_picker.cpp:2239-2287`):
 * `palette_box` (`btn_preset` "Swatches" + `menu_btn`) then
 * `btn_recent_preset` "Recent Colors" — `preset_container`/
 * `recent_preset_hbc` stay collapsed at load (`comparison.md`'s own doc for
 * why: presets only ever arrive through `add_preset()` at runtime).
 */
export function swatchesRowRects(swatches: Rect2, theme: NativeTheme, rtl = false): SwatchesRowRects {
  const menuButtonWidth = colorPickerMenuButtonSize(theme).x;
  // Both rows share the label's own text height, so the block splits evenly
  // around the one `theme.separation` gap between them.
  const rowHeight = (swatches.h - theme.separation) / 2;
  // `btn_recent_preset` is the VBox's own full-width child, so its mirror is
  // the identity — only `palette_box`'s two columns swap.
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

// --- Slider chrome: `Slider::_notification(NOTIFICATION_DRAW)` -------------

/**
 * `values[i]`'s sibling `HSlider`'s own rect within its grid cell:
 * `set_h_size_flags(SIZE_EXPAND_FILL)` (full column width) but
 * `set_v_size_flags(SIZE_SHRINK_CENTER)` (`create_slider`, `color_picker.cpp:
 * 452-453`), so it sits at its own natural HEIGHT (`sliderMinimumSize`,
 * reused from `shared/sliderSolver.ts`), centred in the taller cell the
 * SpinBox's own `LineEdit` dominates.
 */
export function colorPickerSliderBoxRect(cell: Rect2, theme: NativeTheme, grabber: Vec2): Rect2 {
  const h = sliderMinimumSize(false, theme, grabber).y;
  // `Control::fit_child_in_rect` (`control.h`, `SIZE_SHRINK_CENTER`):
  // `r.position.y += Math::floor((p_rect.size.y - minsize.y) / 2)` — FLOOR,
  // never a bare `/2` (which rounds up on an odd remainder in JS's own
  // float arithmetic, off by half a pixel on an odd row height).
  const y = cell.y + Math.floor((cell.h - h) / 2);
  return { x: cell.x, y, w: cell.w, h };
}

/**
 * `_reset_sliders_theme` (`color_picker.cpp:628-651`): every channel slider
 * (`sliders[0..2]`) and `alpha_slider` override `grabber`/`grabber_highlight`
 * to `theme_cache.bar_arrow`, `grabber_offset` to `8 * base_scale`, and (via
 * `theme_cache.center_slider_grabbers`, default `1`) `center_grabber` to
 * true — `intensity_slider` is the one channel `_reset_sliders_theme` never
 * touches, so it alone keeps Slider's own defaults (`shared/sliderSolver.ts`'s
 * own doc for why that shared module assumes them).
 */
export const COLOR_PICKER_SLIDER_GRABBER_OFFSET = 8;

/**
 * The overridden `grabber` icon's own rect, `center_grabber = true`
 * (`slider.cpp:322-334,363`, horizontal branch): `areasize` is the FULL
 * slider width (the `center_grabber ? 0 : grabber->get_width()` subtraction
 * drops out), and `grabber_shift = -grabber->get_width() / 2` centres the
 * icon ON the ratio point rather than keeping it fully inside the track.
 * `Point2i`'s cast truncates the whole `x`/`y` expression once, not each
 * term separately — unlike `grabber_offset`'s own separate int addition.
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
 * `intensity_slider`'s own fixed range (`color_picker.cpp:2183-2185`:
 * `set_min(-10)`, `set_max(10)`) — `resolveSliderRatio`
 * (`shared/sliderSolver.ts`) expects a `RangeProperties` this derived value
 * never has, so its ratio is reproduced directly rather than boxed into one.
 */
export function colorPickerIntensityRatio(value: number): number {
  return (value - -10) / 20;
}
