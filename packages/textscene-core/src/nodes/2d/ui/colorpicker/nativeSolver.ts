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
import type { ColorPickerProperties } from './types';

/** `set_picker_shape`'s own enum (`color_picker.h`'s `PickerShapeType`) — only the one value this previewer draws. */
export const SHAPE_HSV_RECTANGLE = 0;

/** `sv_width`/`sv_height` (`default_theme.cpp:1077-1078`), at scale 1. */
export const COLOR_PICKER_SV_SIZE = 256;
/** `h_width` (`default_theme.cpp:1079`), at scale 1. */
export const COLOR_PICKER_HUE_WIDTH = 30;
/**
 * `btn_pick`/`btn_shape`'s own icon size — `color_picker_pipette.svg`/
 * `picker_shape_rectangle.svg` are both 16x16 (`scene/theme/icons/`). Neither
 * button is drawn (`Component.tsx`'s own doc), so this sizes the SAMPLE row's
 * height as an approximation of the space they would occupy beside it,
 * documented as such on the comparison sheet.
 */
export const COLOR_PICKER_SAMPLE_ICON_SIZE = 16;
/** `sample`'s own row-height fraction (`color_picker.cpp:1397`). */
export const COLOR_PICKER_SAMPLE_HEIGHT_FRACTION = 0.95;

/**
 * `nativeTheme.ts` exposes every ColorPicker metric it needs pre-scaled and
 * independently rounded (`ScaledGodotTheme`'s own doc), but never the raw
 * `gui/theme/default_theme_scale` itself — this slice cannot add it
 * (`nativeTheme.ts` is orchestrator-owned). `separation` (`Math.round(4 *
 * scale)`, `default_theme.cpp:1249-1251`) is the smallest exposed metric
 * scaled by a plain literal, so dividing it back out recovers `scale`
 * exactly at any value whose separation lands on a whole pixel, and to
 * within a rounding step otherwise — the same approximation every other
 * ColorPicker-only constant below inherits.
 */
export function colorPickerScale(theme: Pick<NativeTheme, 'separation'>): number {
  return theme.separation / 4;
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
  /** `sample_hbc`'s own rect. */
  sample: Rect2;
}

/**
 * The shape row's OWN minimum width — `sv_square`'s `custom_minimum_size.x`
 * (`ColorPickerShapeRectangle::update_theme`, `color_picker_shape.cpp:465`)
 * plus the row's `separation` plus `hue_slider`'s fixed `h_width`. `0` when
 * nothing is drawn there.
 */
function shapeRowMinWidth(theme: Pick<NativeTheme, 'separation'>, pickerShape: number | undefined): number {
  if ((pickerShape ?? SHAPE_HSV_RECTANGLE) !== SHAPE_HSV_RECTANGLE) return 0;
  const scale = colorPickerScale(theme);
  return Math.round(COLOR_PICKER_SV_SIZE * scale) + theme.separation + Math.round(COLOR_PICKER_HUE_WIDTH * scale);
}

/**
 * The two rows this painter draws, stacked exactly as `real_vbox`
 * (`color_picker.cpp:2071-2082`) would — `internal_margin`'s own margins are
 * 0 (`default_theme.cpp:1252-1255`, never overridden), so `width` IS this
 * node's own SOLVED width (`get_size().x` at draw time); `sv_square` fills
 * whatever is left after `hue_slider` and the row's `separation`, floored at
 * its own minimum (`shapeRowMinWidth`) exactly as `Control::_size_changed`
 * floors every child against its `fit_child_in_rect` rect.
 *
 * `shape_container` stays a participating VBox row (and so keeps its
 * `separation` gap) even at `picker_shape !== SHAPE_HSV_RECTANGLE`: only its
 * CHILDREN hide per-shape (`ColorPicker::_update_controls`), never the row
 * itself. Only its DRAWN height (`shape.h`) depends on the shape.
 *
 * `mode_hbc`/`slider_gc`/`hex_hbc`/`swatches_vbc` are not modelled: this
 * previewer draws neither their content nor their height (comparison.md's
 * own "Known limitations").
 */
export function colorPickerRows(
  width: number,
  theme: Pick<NativeTheme, 'separation'>,
  pickerShape: number | undefined
): ColorPickerRows {
  const scale = colorPickerScale(theme);
  const svSize = Math.round(COLOR_PICKER_SV_SIZE * scale);
  const drawShape = (pickerShape ?? SHAPE_HSV_RECTANGLE) === SHAPE_HSV_RECTANGLE;

  const shapeHeight = drawShape ? svSize : 0;
  const shape: Rect2 | null = drawShape
    ? { x: 0, y: 0, w: Math.max(shapeRowMinWidth(theme, pickerShape), width), h: svSize }
    : null;

  const sampleY = shapeHeight + theme.separation;
  const sampleHeight = Math.round(COLOR_PICKER_SAMPLE_ICON_SIZE * scale) + 2 * Math.round(4 * scale);
  const sample: Rect2 = { x: 0, y: sampleY, w: width, h: sampleHeight };

  return { shape, sample };
}

/**
 * `ColorPicker::get_minimum_size` is not overridden — Godot floors it from
 * `real_vbox`'s own combined minimum, i.e. from what the internal rows
 * actually need. This sums only the rows `Component.tsx` draws (see
 * `colorPickerRows`'s own doc for which those are); `mode_hbc`/`slider_gc`/
 * `hex_hbc`/`swatches_vbc` contribute nothing here, which under-reports
 * Godot's real minimum whenever any of them is visible.
 */
export const colorPickerMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as ColorPickerProperties;
  const theme = ctx.theme;
  const scale = colorPickerScale(theme);

  const width = shapeRowMinWidth(theme, props.pickerShape);
  const shapeHeight =
    (props.pickerShape ?? SHAPE_HSV_RECTANGLE) === SHAPE_HSV_RECTANGLE ? Math.round(COLOR_PICKER_SV_SIZE * scale) : 0;
  const sampleHeight = Math.round(COLOR_PICKER_SAMPLE_ICON_SIZE * scale) + 2 * Math.round(4 * scale);
  const height = shapeHeight + theme.separation + sampleHeight;

  return { x: width, y: height };
};

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
export function svAndHueRects(shape: Rect2, theme: Pick<NativeTheme, 'separation'>): ShapeRowSplit {
  const scale = colorPickerScale(theme);
  const hueWidth = Math.round(COLOR_PICKER_HUE_WIDTH * scale);
  const svWidth = shape.w - theme.separation - hueWidth;
  return {
    svSquare: { x: shape.x, y: shape.y, w: svWidth, h: shape.h },
    hueSlider: { x: shape.x + svWidth + theme.separation, y: shape.y, w: hueWidth, h: shape.h },
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
